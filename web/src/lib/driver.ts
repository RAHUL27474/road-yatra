import { db } from "./db";
import { getRequestUser } from "./auth";
import { HttpError } from "./http";
import { assignInvoiceNo, publicStop } from "./booking";

const START_EARLY_HOURS = 3; // a driver can start a trip up to this long before departure

export async function requireDriver(req: Request) {
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  const driver = await db.driver.findUnique({ where: { userId: user.id } });
  if (driver?.status === "PENDING") throw new HttpError(403, "Your driver application is still under review.");
  if (driver?.status === "REJECTED") throw new HttpError(403, "Your driver application was not approved.");
  if (user.role !== "DRIVER" || !driver) throw new HttpError(403, "This account is not a driver account.");
  if (!driver.active) throw new HttpError(403, "Your driver account is inactive. Please contact the office.");
  return { user, driver };
}

const amountDue = (b: { paymentStatus: string; totalAmount: number; status: string }) =>
  b.status !== "CANCELLED" && b.paymentStatus === "UNPAID" ? b.totalAmount : 0;

/** Trips and rentals assigned to the driver, from yesterday to `days` days ahead. */
export async function listDuties(driverId: string, days = 7) {
  const from = new Date(Date.now() - 24 * 3600_000);
  const to = new Date(Date.now() + days * 24 * 3600_000);

  const trips = await db.trip.findMany({
    where: {
      driverId,
      status: { not: "CANCELLED" },
      OR: [{ departAt: { gte: from, lt: to } }, { status: "STARTED" }],
    },
    include: {
      route: true,
      vehicle: true,
      bookings: { where: { status: { in: ["CONFIRMED", "COMPLETED"] } }, include: { pickupStop: true, dropStop: true }, orderBy: { createdAt: "asc" } },
      seats: { where: { bookingId: null } },
    },
    orderBy: { departAt: "asc" },
  });

  const rentals = await db.booking.findMany({
    where: {
      driverId,
      kind: "RENTAL",
      status: { in: ["CONFIRMED", "COMPLETED"] },
      OR: [{ startAt: { gte: from, lt: to } }, { startedAt: { not: null }, completedAt: null }],
    },
    include: { vehicle: true },
    orderBy: { startAt: "asc" },
  });

  return [
    ...trips.map((t) => ({
      kind: "TRIP" as const,
      id: t.id,
      fromCity: t.route.fromCity,
      toCity: t.route.toCity,
      startAt: t.departAt,
      endAt: t.arriveAt,
      status: t.status, // SCHEDULED | STARTED | COMPLETED
      boardingPoint: t.boardingPoint,
      dropPoint: t.dropPoint,
      vehicle: { id: t.vehicle.id, name: t.vehicle.name, regNumber: t.vehicle.regNumber, seats: t.vehicle.seats },
      blockedSeats: t.seats.map((s) => ({ seatNo: s.seatNo, reason: s.blockReason })),
      passengers: t.bookings.map((b) => ({
        bookingId: b.id,
        code: b.code,
        name: b.passengerName,
        phone: b.passengerPhone,
        seatNos: b.seatNos ? b.seatNos.split(",").map(Number) : [],
        pickupStop: b.pickupStop ? publicStop(b.pickupStop) : null,
        dropStop: b.dropStop ? publicStop(b.dropStop) : null,
        paymentStatus: b.paymentStatus,
        paymentMode: b.paymentMode,
        amountDue: amountDue(b),
        boarded: !!b.boardedAt,
        noShow: b.noShow,
      })),
    })),
    ...rentals.map((b) => ({
      kind: "RENTAL" as const,
      id: b.id,
      code: b.code,
      rentalType: b.rentalType,
      fromCity: b.pickupCity,
      toCity: b.dropCity,
      startAt: b.startAt,
      endAt: b.endAt,
      status: b.completedAt ? "COMPLETED" : b.startedAt ? "STARTED" : "SCHEDULED",
      vehicle: b.vehicle ? { id: b.vehicle.id, name: b.vehicle.name, regNumber: b.vehicle.regNumber, seats: b.vehicle.seats } : null,
      customer: { name: b.passengerName, phone: b.passengerPhone, passengers: b.passengers },
      pickupAddress: b.pickupAddress,
      dropAddress: b.dropAddress,
      estimatedKm: b.estimatedKm,
      startOdometer: b.startOdometer,
      endOdometer: b.endOdometer,
      paymentStatus: b.paymentStatus,
      paymentMode: b.paymentMode,
      amountDue: amountDue(b),
    })),
  ].sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0));
}

async function driverTrip(driverId: string, tripId: string) {
  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.driverId !== driverId) throw new HttpError(404, "Trip not found in your duties.");
  return trip;
}

async function driverRental(driverId: string, bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.kind !== "RENTAL" || b.driverId !== driverId) throw new HttpError(404, "Booking not found in your duties.");
  if (b.status !== "CONFIRMED") throw new HttpError(400, `This booking is ${b.status.toLowerCase()}.`);
  return b;
}

/** Finds a seat booking on one of the driver's trips, by id or by the QR text "RY:<code>:<otp>". */
async function driverSeatBooking(driverId: string, ref: { bookingId?: string; qr?: string }) {
  let where;
  let qrOtp: string | undefined;
  if (ref.qr) {
    const m = /^RY:([A-Z0-9]+):(\d{4})$/.exec(ref.qr.trim());
    if (!m) throw new HttpError(400, "This QR code is not a booking ticket.");
    where = { code: m[1] };
    qrOtp = m[2];
  } else if (ref.bookingId) where = { id: ref.bookingId };
  else throw new HttpError(400, "Booking is required.");

  const b = await db.booking.findUnique({ where, include: { trip: true } });
  if (!b || b.kind !== "SEAT" || b.trip?.driverId !== driverId) throw new HttpError(404, "This ticket is not for your trip.");
  if (b.status !== "CONFIRMED") throw new HttpError(400, `This booking is ${b.status.toLowerCase()}.`);
  return { booking: b, qrOtp };
}

export async function boardPassenger(driverId: string, input: { bookingId?: string; qr?: string; otp?: string }) {
  const { booking, qrOtp } = await driverSeatBooking(driverId, input);
  const otp = qrOtp ?? input.otp;
  if (booking.boardedAt) throw new HttpError(400, `${booking.passengerName} has already boarded.`);
  if (otp !== booking.boardingOtp) throw new HttpError(400, "Wrong boarding OTP.");
  await db.booking.update({ where: { id: booking.id }, data: { boardedAt: new Date(), noShow: false } });
  return { bookingId: booking.id, name: booking.passengerName, seatNos: booking.seatNos ? booking.seatNos.split(",").map(Number) : [], amountDue: amountDue(booking) };
}

export async function markNoShow(driverId: string, bookingId: string) {
  const { booking } = await driverSeatBooking(driverId, { bookingId });
  if (booking.boardedAt) throw new HttpError(400, "This passenger has already boarded.");
  await db.booking.update({ where: { id: booking.id }, data: { noShow: true } });
}

/** Driver confirms cash was received for a booking on their trip or rental. */
export async function collectCash(driverId: string, bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { trip: true } });
  const mine = b && (b.driverId === driverId || b.trip?.driverId === driverId);
  if (!b || !mine) throw new HttpError(404, "Booking not found in your duties.");
  if (b.paymentStatus !== "UNPAID" || b.status === "CANCELLED") throw new HttpError(400, "Nothing to collect for this booking.");
  await db.booking.update({ where: { id: b.id }, data: { paymentStatus: "PAID", paymentMode: "CASH", paidAt: new Date() } });
  await assignInvoiceNo(b.id);
  return { collected: b.totalAmount };
}

export async function startTrip(driverId: string, tripId: string) {
  const trip = await driverTrip(driverId, tripId);
  if (trip.status !== "SCHEDULED") throw new HttpError(400, `This trip is already ${trip.status.toLowerCase()}.`);
  if (trip.departAt.getTime() - Date.now() > START_EARLY_HOURS * 3600_000) throw new HttpError(400, "It is too early to start this trip.");
  await db.trip.update({ where: { id: trip.id }, data: { status: "STARTED", startedAt: new Date() } });
}

export async function endTrip(driverId: string, tripId: string) {
  const trip = await driverTrip(driverId, tripId);
  if (trip.status !== "STARTED") throw new HttpError(400, "Start the trip first.");
  const now = new Date();
  await db.$transaction([
    db.trip.update({ where: { id: trip.id }, data: { status: "COMPLETED", completedAt: now } }),
    db.booking.updateMany({ where: { tripId: trip.id, status: "CONFIRMED", boardedAt: { not: null } }, data: { status: "COMPLETED", completedAt: now } }),
    db.booking.updateMany({ where: { tripId: trip.id, status: "CONFIRMED", boardedAt: null }, data: { status: "COMPLETED", completedAt: now, noShow: true } }),
  ]);
}

export async function startRental(driverId: string, bookingId: string, input: { otp: string; odometer?: number }) {
  const b = await driverRental(driverId, bookingId);
  if (b.startedAt) throw new HttpError(400, "This trip has already started.");
  if (b.startAt && b.startAt.getTime() - Date.now() > START_EARLY_HOURS * 3600_000) throw new HttpError(400, "It is too early to start this trip.");
  if (input.otp !== b.boardingOtp) throw new HttpError(400, "Wrong start OTP. Ask the customer for the OTP shown in their booking.");
  await db.booking.update({ where: { id: b.id }, data: { startedAt: new Date(), boardedAt: new Date(), startOdometer: input.odometer ?? null } });
}

export async function endRental(driverId: string, bookingId: string, input: { otp: string; odometer?: number }) {
  const b = await driverRental(driverId, bookingId);
  if (!b.startedAt) throw new HttpError(400, "Start the trip first.");
  if (input.otp !== b.endOtp) throw new HttpError(400, "Wrong end OTP. Ask the customer for the end-trip OTP shown in their booking.");
  if (input.odometer != null && b.startOdometer != null && input.odometer < b.startOdometer) throw new HttpError(400, "End odometer is less than start odometer.");
  await db.booking.update({ where: { id: b.id }, data: { completedAt: new Date(), status: "COMPLETED", endOdometer: input.odometer ?? null } });
  const kmDriven = input.odometer != null && b.startOdometer != null ? input.odometer - b.startOdometer : null;
  return { kmDriven, includedKm: b.estimatedKm, amountDue: amountDue(b) };
}

/** Stores the latest GPS fix for the vehicle on the driver's trip that is in progress. */
export async function updateLocation(driverId: string, p: { lat: number; lng: number; speed?: number; heading?: number }) {
  const trip = await db.trip.findFirst({ where: { driverId, status: "STARTED" }, orderBy: { startedAt: "desc" } });
  const rental = trip
    ? null
    : await db.booking.findFirst({ where: { driverId, kind: "RENTAL", startedAt: { not: null }, completedAt: null }, orderBy: { startedAt: "desc" } });
  const vehicleId = trip?.vehicleId ?? rental?.vehicleId;
  if (!vehicleId) throw new HttpError(409, "No trip in progress. Location is only shared during a trip.");
  const data = { driverId, lat: p.lat, lng: p.lng, speed: p.speed ?? null, heading: p.heading ?? null };
  await db.vehicleLocation.upsert({ where: { vehicleId }, update: data, create: { vehicleId, ...data } });
  return { vehicleId };
}
