import type { Vehicle } from "@prisma/client";
import { db } from "./db";
import { getRequestUser } from "./auth";
import { HttpError } from "./http";
import { assignInvoiceNo, cashDue, publicStop } from "./booking";
import { fmtDateTime } from "./format";
import { notify, officePhone } from "./notify";

const START_EARLY_HOURS = 3; // a driver can start a trip up to this long before departure
const HISTORY_DAYS = 30;

const dutyVehicle = (v: Vehicle) => ({
  id: v.id,
  name: v.name,
  regNumber: v.regNumber,
  seats: v.seats,
  // Shown in the app so the driver knows when the papers of the car they drive run out.
  docs: { insurance: v.insuranceExpiry, permit: v.permitExpiry, fitness: v.fitnessExpiry, puc: v.pucExpiry },
});

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

const amountDue = cashDue;
const NEAR_KM = 3; // "your driver is near" once the vehicle is this close to an unboarded passenger's pickup

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
      bookings: {
        where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
        include: { pickupStop: true, dropStop: true, seats: { orderBy: { seatNo: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
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
      response: t.driverResponse, // null until the driver accepts
      boardingPoint: t.boardingPoint,
      dropPoint: t.dropPoint,
      vehicle: dutyVehicle(t.vehicle),
      blockedSeats: t.seats.map((s) => ({ seatNo: s.seatNo, reason: s.blockReason })),
      passengers: t.bookings.map((b) => ({
        bookingId: b.id,
        code: b.code,
        name: b.passengerName,
        phone: b.passengerPhone,
        seatNos: b.seatNos ? b.seatNos.split(",").map(Number) : [],
        // Who sits where, when the booker named a traveller per seat; female = women's seat.
        seatPassengers: b.seats.map((s) => ({ seatNo: s.seatNo, name: s.passengerName, phone: s.passengerPhone, female: s.female })),
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
      response: b.driverResponse,
      vehicle: b.vehicle ? dutyVehicle(b.vehicle) : null,
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
/**
 * Driver confirms the passenger paid: in cash (the driver holds it for the office) or by UPI straight to the
 * office account (nothing for the driver to hand over).
 */
export async function collectCash(driverId: string, bookingId: string, mode: "CASH" | "UPI" = "CASH") {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { trip: true } });
  const mine = b && (b.driverId === driverId || b.trip?.driverId === driverId);
  if (!b || !mine) throw new HttpError(404, "Booking not found in your duties.");
  if (b.status !== "CONFIRMED" && b.status !== "COMPLETED") throw new HttpError(400, `This booking is ${b.status.toLowerCase()}.`);
  const due = cashDue(b);
  if (due <= 0) throw new HttpError(400, "Nothing to collect for this booking.");
  // Claim it once: a retried request (or the office marking it paid at the same time) must not record it twice.
  const { count } = await db.booking.updateMany({
    where: { id: b.id, paymentStatus: { in: ["UNPAID", "PARTIAL"] } },
    // After an online advance the booking keeps paymentMode ADVANCE; the driver only collects the balance.
    data: {
      paymentStatus: "PAID",
      paymentMode: b.paymentMode === "ADVANCE" ? "ADVANCE" : mode,
      // An advance keeps its own payment date; the cash part is dated by cashCollectedAt.
      ...(b.paymentMode === "ADVANCE" ? {} : { paidAt: new Date() }),
      cashCollectedBy: driverId,
      cashCollected: mode === "UPI" ? 0 : due,
      cashCollectedAt: new Date(),
      cashHandedOverAt: null,
    },
  });
  if (!count) throw new HttpError(400, "Payment for this booking is already recorded.");
  await assignInvoiceNo(b.id);
  return { collected: due, mode };
}

export async function startTrip(driverId: string, tripId: string) {
  const trip = await driverTrip(driverId, tripId);
  if (trip.status !== "SCHEDULED") throw new HttpError(400, `This trip is already ${trip.status.toLowerCase()}.`);
  if (trip.departAt.getTime() - Date.now() > START_EARLY_HOURS * 3600_000) throw new HttpError(400, "It is too early to start this trip.");
  // Starting a duty is also accepting it.
  await db.trip.update({ where: { id: trip.id }, data: { status: "STARTED", startedAt: new Date(), driverResponse: "ACCEPTED", driverRespondedAt: trip.driverRespondedAt ?? new Date() } });
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
  await db.booking.update({
    where: { id: b.id },
    data: { startedAt: new Date(), boardedAt: new Date(), startOdometer: input.odometer ?? null, driverResponse: "ACCEPTED", driverRespondedAt: b.driverRespondedAt ?? new Date() },
  });
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
  if (!trip && !rental) throw new HttpError(409, "No trip in progress. Location is only shared during a trip.");
  const vehicleId = trip?.vehicleId ?? rental?.vehicleId;
  // A full-cab booking started before the office picked a vehicle: nowhere to store the fix yet, but the
  // trip is real, so keep the app sharing (a 409 here would switch sharing off for the whole trip).
  if (!vehicleId) return { vehicleId: null };
  const data = { driverId, lat: p.lat, lng: p.lng, speed: p.speed ?? null, heading: p.heading ?? null };
  await db.vehicleLocation.upsert({ where: { vehicleId }, update: data, create: { vehicleId, ...data } });
  if (trip) await notifyNearbyPassengers(trip.id, p);
  return { vehicleId };
}

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** Once per booking: WhatsApp "your driver is about N min away" when the vehicle nears the pickup point. */
async function notifyNearbyPassengers(tripId: string, at: { lat: number; lng: number }) {
  const waiting = await db.booking.findMany({
    where: { tripId, status: "CONFIRMED", boardedAt: null, noShow: false, nearNotifiedAt: null, pickupStop: { lat: { not: null }, lng: { not: null } } },
    include: { pickupStop: true, trip: { include: { vehicle: true, driver: { include: { user: true } } } } },
  });
  for (const b of waiting) {
    const stop = b.pickupStop!;
    const d = km(at, { lat: stop.lat!, lng: stop.lng! });
    if (d > NEAR_KM) continue;
    // Claim it first so two location updates can't both send.
    const { count } = await db.booking.updateMany({ where: { id: b.id, nearNotifiedAt: null }, data: { nearNotifiedAt: new Date() } });
    if (!count) continue;
    const mins = Math.max(2, Math.round((d / 30) * 60));
    const reg = b.trip?.vehicle.regNumber ?? "";
    const driver = b.trip?.driver?.user;
    await notify(
      b.passengerPhone,
      "DRIVER_NEARBY",
      [b.code, String(mins), stop.name, reg, driver?.phone ?? ""],
      `Booking ${b.code}: your vehicle ${reg} is about ${mins} min from ${stop.name}. Please be ready at the pickup point.${driver ? ` Driver: ${driver.phone}` : ""}`,
    );
  }
}

// ---------- Accept / reject ----------

/** Driver accepts or turns down a duty that has not started. Rejecting hands it back to the office. */
export async function respondToDuty(
  driver: { id: string },
  driverName: string,
  kind: "TRIP" | "RENTAL",
  id: string,
  input: { accept: boolean; reason?: string },
) {
  const reason = input.reason?.trim() ?? "";
  if (!input.accept && reason.length < 3) throw new HttpError(400, "Tell the office why you can't take this duty.");
  const now = new Date();

  if (kind === "TRIP") {
    const trip = await driverTrip(driver.id, id);
    if (trip.status !== "SCHEDULED") throw new HttpError(400, `This trip is already ${trip.status.toLowerCase()}.`);
    if (input.accept) {
      await db.trip.update({ where: { id }, data: { driverResponse: "ACCEPTED", driverRespondedAt: now, driverNote: null } });
      return;
    }
    const full = await db.trip.findUniqueOrThrow({ where: { id }, include: { route: true } });
    await db.trip.update({ where: { id }, data: { driverId: null, driverResponse: "REJECTED", driverRespondedAt: now, driverNote: `${driverName} rejected: ${reason}` } });
    await alertOffice(`${driverName} rejected the ${full.route.fromCity} → ${full.route.toCity} trip of ${fmtDateTime(full.departAt)}: ${reason}. Please assign another driver.`);
    return;
  }

  const b = await driverRental(driver.id, id);
  if (b.startedAt) throw new HttpError(400, "This trip has already started.");
  if (input.accept) {
    await db.booking.update({ where: { id }, data: { driverResponse: "ACCEPTED", driverRespondedAt: now, driverNote: null } });
    return;
  }
  await db.booking.update({ where: { id }, data: { driverId: null, driverResponse: "REJECTED", driverRespondedAt: now, driverNote: `${driverName} rejected: ${reason}` } });
  await alertOffice(`${driverName} rejected full-cab booking ${b.code}${b.startAt ? ` (${fmtDateTime(b.startAt)})` : ""}: ${reason}. Please assign another driver.`);
}

async function alertOffice(body: string, event: "DUTY_REJECTED" | "SOS" = "DUTY_REJECTED") {
  const to = officePhone();
  if (to) await notify(to, event, [body], body);
  else await db.notification.create({ data: { channel: "SMS", to: "office", event, body, status: "LOGGED", error: "No ADMIN_PHONE set" } });
}

/** Tells the driver they have a new duty (SMS / WhatsApp; the app also checks for new duties by itself). */
export async function notifyDriverDuty(kind: "TRIP" | "RENTAL", id: string) {
  if (kind === "TRIP") {
    const t = await db.trip.findUnique({ where: { id }, include: { route: true, vehicle: true, driver: { include: { user: true } } } });
    if (!t?.driver) return;
    const what = `${t.route.fromCity} → ${t.route.toCity}`;
    const when = fmtDateTime(t.departAt);
    await notify(t.driver.user.phone, "DUTY_ASSIGNED", [what, when, t.vehicle.regNumber], `New duty: ${what} on ${when}, vehicle ${t.vehicle.regNumber}. Open the JSS Travels Driver app to accept it.`);
    return;
  }
  const b = await db.booking.findUnique({ where: { id }, include: { vehicle: true, driver: { include: { user: true } } } });
  if (!b?.driver) return;
  const what = `Full cab ${b.code}, ${b.pickupCity}${b.dropCity && b.dropCity !== b.pickupCity ? ` → ${b.dropCity}` : ""}`;
  const when = b.startAt ? fmtDateTime(b.startAt) : "";
  await notify(b.driver.user.phone, "DUTY_ASSIGNED", [what, when, b.vehicle?.regNumber ?? ""], `New duty: ${what} on ${when}${b.vehicle ? `, vehicle ${b.vehicle.regNumber}` : ""}. Open the JSS Travels Driver app to accept it.`);
}

// ---------- SOS ----------

export async function raiseSos(driver: { id: string; emergencyContact: string }, user: { name: string; phone: string }, p: { lat?: number; lng?: number }) {
  const trip = await db.trip.findFirst({ where: { driverId: driver.id, status: "STARTED" }, include: { vehicle: true }, orderBy: { startedAt: "desc" } });
  const rental = trip
    ? null
    : await db.booking.findFirst({ where: { driverId: driver.id, kind: "RENTAL", startedAt: { not: null }, completedAt: null }, include: { vehicle: true } });
  const vehicleReg = trip?.vehicle.regNumber ?? rental?.vehicle?.regNumber ?? null;
  const alert = await db.sosAlert.create({
    data: { driverId: driver.id, lat: p.lat ?? null, lng: p.lng ?? null, tripId: trip?.id ?? null, bookingId: rental?.id ?? null, vehicleReg },
  });
  const map = p.lat != null && p.lng != null ? ` Location: https://maps.google.com/?q=${p.lat},${p.lng}` : "";
  const body = `SOS from driver ${user.name} (${user.phone})${vehicleReg ? `, vehicle ${vehicleReg}` : ""}.${map}`;
  await alertOffice(body, "SOS");
  const contact = driver.emergencyContact.replace(/\D/g, "").slice(-10);
  if (/^[6-9]\d{9}$/.test(contact)) await notify(contact, "SOS", [body], body);
  return { id: alert.id };
}

// ---------- Cash & history ----------

const istDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Cash the driver still holds, a per-day summary and the duties completed in the last 30 days. */
export async function driverEarnings(driverId: string) {
  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 3600_000);
  const [held, collected, trips, rentals] = await Promise.all([
    // Cash the driver took stays theirs to hand over even if the booking is later cancelled and refunded.
    db.booking.aggregate({ where: { cashCollectedBy: driverId, cashHandedOverAt: null, cashCollected: { gt: 0 } }, _sum: { cashCollected: true }, _count: true }),
    db.booking.findMany({ where: { cashCollectedBy: driverId, cashCollectedAt: { gte: since } }, select: { id: true, tripId: true, cashCollected: true, cashCollectedAt: true } }),
    db.trip.findMany({
      where: { driverId, status: "COMPLETED", completedAt: { gte: since } },
      include: { route: true, vehicle: true, bookings: { where: { status: "COMPLETED" }, select: { passengers: true, seatNos: true, noShow: true } } },
      orderBy: { completedAt: "desc" },
    }),
    db.booking.findMany({ where: { driverId, kind: "RENTAL", status: "COMPLETED", completedAt: { gte: since } }, include: { vehicle: true }, orderBy: { completedAt: "desc" } }),
  ]);

  const cashByTrip = new Map<string, number>();
  const cashByBooking = new Map<string, number>();
  for (const c of collected) {
    if (c.tripId) cashByTrip.set(c.tripId, (cashByTrip.get(c.tripId) ?? 0) + c.cashCollected);
    else cashByBooking.set(c.id, c.cashCollected);
  }

  const history = [
    ...trips.map((t) => {
      const boarded = t.bookings.filter((b) => !b.noShow);
      return {
        kind: "TRIP" as const,
        id: t.id,
        title: `${t.route.fromCity} → ${t.route.toCity}`,
        at: t.departAt,
        completedAt: t.completedAt!,
        vehicleReg: t.vehicle.regNumber,
        passengers: boarded.reduce((n, b) => n + (b.seatNos ? b.seatNos.split(",").length : b.passengers), 0),
        km: t.route.distanceKm,
        cash: cashByTrip.get(t.id) ?? 0,
      };
    }),
    ...rentals.map((b) => ({
      kind: "RENTAL" as const,
      id: b.id,
      title: b.dropCity && b.dropCity !== b.pickupCity ? `${b.pickupCity} → ${b.dropCity}` : (b.pickupCity ?? "Full cab"),
      at: b.startAt ?? b.completedAt!,
      completedAt: b.completedAt!,
      vehicleReg: b.vehicle?.regNumber ?? null,
      passengers: b.passengers,
      km: b.endOdometer != null && b.startOdometer != null ? b.endOdometer - b.startOdometer : b.estimatedKm,
      cash: cashByBooking.get(b.id) ?? 0,
    })),
  ].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

  const days = new Map<string, { date: string; duties: number; passengers: number; km: number; cash: number }>();
  const day = (date: string) => days.get(date) ?? days.set(date, { date, duties: 0, passengers: 0, km: 0, cash: 0 }).get(date)!;
  for (const h of history) {
    const d = day(istDay(h.completedAt));
    d.duties++;
    d.passengers += h.passengers;
    d.km += h.km ?? 0;
  }
  for (const c of collected) if (c.cashCollectedAt) day(istDay(c.cashCollectedAt)).cash += c.cashCollected;

  return {
    cashInHand: held._sum.cashCollected ?? 0,
    cashInHandCount: held._count,
    days: [...days.values()].sort((a, b) => b.date.localeCompare(a.date)),
    history,
  };
}
