import crypto from "node:crypto";
import { Prisma, type Booking, type Trip, type Route, type Vehicle, type Stop, type Driver, type User } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./http";
import { signToken } from "./auth";
import { getSettings, type CancellationSlab } from "./settings";
import { notify } from "./notify";
import { fmtDateTime } from "./format";
import { onlinePaymentsAvailable } from "./payment-mode";

export const GST_RATE = 0.05; // 5% GST on passenger transport — confirm the right treatment with your CA
export const HOLD_MINUTES = 10; // unpaid online bookings are released after this
const TRACK_WINDOW_HOURS = 12; // tracking link becomes active this long before departure

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const appUrl = () => process.env.APP_URL || "http://localhost:3000";

export function newBookingCode() {
  let code = "RY";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

const newOtp = () => String(crypto.randomInt(1000, 10000));
const round = (n: number) => Math.round(n);

export function withTax(base: number, extraCharges = 0) {
  const baseAmount = round(base);
  const taxAmount = round(baseAmount * GST_RATE);
  const extra = round(extraCharges);
  return { baseAmount, taxAmount, extraCharges: extra, totalAmount: baseAmount + taxAmount + extra };
}

/** Releases seats and vehicles held by online bookings that were never paid. */
export async function expireStaleHolds() {
  const cutoff = new Date(Date.now() - HOLD_MINUTES * 60_000);
  const stale = await db.booking.findMany({ where: { status: "PENDING", createdAt: { lt: cutoff } }, select: { id: true } });
  if (!stale.length) return;
  const ids = stale.map((b) => b.id);
  await db.$transaction([
    db.bookedSeat.deleteMany({ where: { bookingId: { in: ids } } }),
    db.booking.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED" } }),
  ]);
}

/** Finds the customer account for a phone number, creating one for offline (phone/walk-in) bookings. */
export async function findOrCreateCustomer(phone: string, name: string) {
  return (await db.user.findUnique({ where: { phone } })) ?? db.user.create({ data: { phone, name } });
}

export type PaymentChoice = "ONLINE" | "CASH";
type Channel = { source?: "ONLINE" | "OFFLINE"; payment: PaymentChoice; markPaid?: boolean };

async function checkCashAllowed(c: Channel) {
  if (c.payment === "ONLINE" && c.source !== "OFFLINE" && !onlinePaymentsAvailable()) {
    throw new HttpError(400, "Online payment is not available yet. Please choose Pay cash to driver.");
  }
  if (c.payment === "CASH" && c.source !== "OFFLINE" && !(await getSettings()).allowCash) {
    throw new HttpError(400, "Cash payment is not available right now. Please pay online.");
  }
}

/** Status fields for a new booking: online payments wait for the gateway, cash/offline ones are confirmed now. */
function initialStatus(c: Channel) {
  if (c.payment === "ONLINE" && c.source !== "OFFLINE") return { status: "PENDING", paymentStatus: "UNPAID" };
  return { status: "CONFIRMED", paymentStatus: c.markPaid ? "PAID" : "UNPAID", paymentMode: "CASH", paidAt: c.markPaid ? new Date() : null };
}

// ---------- Seat booking ----------

export async function getTakenSeats(tripId: string) {
  const rows = await db.bookedSeat.findMany({ where: { tripId }, select: { seatNo: true } });
  return rows.map((r) => r.seatNo);
}

export async function createSeatBooking(
  input: Channel & {
    userId: string;
    tripId: string;
    seatNos: number[];
    passengerName: string;
    passengerPhone: string;
    pickupStopId?: string;
    dropStopId?: string;
  },
) {
  await expireStaleHolds();
  await checkCashAllowed(input);
  const trip = await db.trip.findUnique({ where: { id: input.tripId }, include: { vehicle: true, route: true } });
  if (!trip || trip.status !== "SCHEDULED") throw new HttpError(404, "This trip is not available for booking.");
  if (trip.departAt <= new Date()) throw new HttpError(400, "This trip has already departed.");

  const seatNos = [...new Set(input.seatNos)].sort((a, b) => a - b);
  if (!seatNos.length) throw new HttpError(400, "Select at least one seat.");
  if (seatNos.some((s) => s < 1 || s > trip.vehicle.seats)) throw new HttpError(400, "Invalid seat selected.");

  const stops = await db.stop.findMany({ where: { id: { in: [input.pickupStopId, input.dropStopId].filter((x): x is string => !!x) }, active: true } });
  const pickup = stops.find((s) => s.id === input.pickupStopId);
  const drop = stops.find((s) => s.id === input.dropStopId);
  if (input.pickupStopId && pickup?.city !== trip.route.fromCity) throw new HttpError(400, "Choose a pickup point in " + trip.route.fromCity + ".");
  if (input.dropStopId && drop?.city !== trip.route.toCity) throw new HttpError(400, "Choose a drop point in " + trip.route.toCity + ".");

  const amounts = withTax(trip.fare * seatNos.length);
  let booking: Booking;
  try {
    booking = await db.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          code: newBookingCode(),
          userId: input.userId,
          kind: "SEAT",
          source: input.source ?? "ONLINE",
          tripId: trip.id,
          seatNos: seatNos.join(","),
          pickupStopId: pickup?.id,
          dropStopId: drop?.id,
          passengers: seatNos.length,
          passengerName: input.passengerName,
          passengerPhone: input.passengerPhone,
          boardingOtp: newOtp(),
          ...initialStatus(input),
          ...amounts,
        },
      });
      await tx.bookedSeat.createMany({ data: seatNos.map((seatNo) => ({ tripId: trip.id, seatNo, bookingId: b.id })) });
      return b;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError(409, "Sorry, one or more of those seats was just booked by someone else. Please pick again.");
    }
    throw e;
  }
  if (booking.status === "CONFIRMED") await onBookingConfirmed(booking.id);
  return booking;
}

// ---------- Rental (hire the whole vehicle) ----------

export type RentalType = "ONE_WAY" | "ROUND_TRIP" | "LOCAL" | "AIRPORT";

export type RentalRequest = {
  rentalType: RentalType;
  pickupCity: string;
  dropCity?: string;
  startAt: Date;
  returnAt?: Date; // round trips only
};

export async function findRoute(a: string, b: string) {
  return db.route.findFirst({
    where: {
      OR: [
        { fromCity: a, toCity: b },
        { fromCity: b, toCity: a },
      ],
    },
  });
}

type Plan = { km: number; days: number; startAt: Date; endAt: Date; route: Route | null };

/** Works out distance, billable days and how long the vehicle is busy. */
export async function planRental(req: RentalRequest, opts: { allowPast?: boolean } = {}): Promise<Plan> {
  const { rentalType, startAt } = req;
  if (!opts.allowPast && startAt.getTime() < Date.now() + 60 * 60_000) throw new HttpError(400, "Pickup time must be at least 1 hour from now.");

  if (rentalType === "LOCAL") {
    return { km: 80, days: 1, startAt, endAt: new Date(startAt.getTime() + 8 * 3600_000), route: null };
  }
  if (rentalType === "AIRPORT") {
    return { km: 40, days: 1, startAt, endAt: new Date(startAt.getTime() + 3 * 3600_000), route: null };
  }

  if (!req.dropCity) throw new HttpError(400, "Please choose a drop city.");
  if (req.dropCity === req.pickupCity) throw new HttpError(400, "Pickup and drop city must be different.");
  const route = await findRoute(req.pickupCity, req.dropCity);
  if (!route) throw new HttpError(404, `We don't serve ${req.pickupCity} to ${req.dropCity} online yet. Please call us for a quote.`);

  if (rentalType === "ONE_WAY") {
    const days = Math.max(1, Math.ceil(route.distanceKm / 500));
    // The vehicle also has to come back, so it is busy for twice the journey time.
    const endAt = new Date(startAt.getTime() + (route.durationMins * 2 + 60) * 60_000);
    return { km: route.distanceKm, days, startAt, endAt, route };
  }

  // ROUND_TRIP
  if (!req.returnAt) throw new HttpError(400, "Please choose a return date.");
  if (req.returnAt <= startAt) throw new HttpError(400, "Return must be after pickup.");
  const endAt = new Date(req.returnAt.getTime() + route.durationMins * 60_000);
  const days = Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / (24 * 3600_000)));
  return { km: route.distanceKm * 2, days, startAt, endAt, route };
}

export function priceRental(vehicle: Vehicle, rentalType: RentalType, plan: Plan) {
  let base: number;
  let billableKm = plan.km;
  let legs = 0; // how many times tolls/parking apply
  switch (rentalType) {
    case "LOCAL":
      base = vehicle.localPackage;
      break;
    case "AIRPORT":
      base = vehicle.airportFare;
      break;
    case "ONE_WAY":
      base = plan.km * vehicle.ratePerKm + vehicle.driverAllowance * plan.days;
      legs = 1;
      break;
    case "ROUND_TRIP":
      billableKm = Math.max(plan.km, vehicle.minKmPerDay * plan.days);
      base = billableKm * vehicle.ratePerKm + vehicle.driverAllowance * plan.days;
      legs = 2;
      break;
  }
  const toll = round((plan.route?.tollAmount ?? 0) * vehicle.tollFactor * legs);
  const parking = round((plan.route?.parkingAmount ?? 0) * legs);
  const driverAllowance = rentalType === "ONE_WAY" || rentalType === "ROUND_TRIP" ? vehicle.driverAllowance * plan.days : 0;
  return { ...withTax(base, toll + parking), billableKm, toll, parking, driverAllowance };
}

/** True if the vehicle has no confirmed/held booking or scheduled trip overlapping the window. */
async function isVehicleFree(tx: Prisma.TransactionClient, vehicleId: string, startAt: Date, endAt: Date) {
  const clash = await tx.booking.findFirst({
    where: { vehicleId, kind: "RENTAL", status: { in: ["PENDING", "CONFIRMED"] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
    select: { id: true },
  });
  if (clash) return false;
  const trip = await tx.trip.findFirst({
    where: { vehicleId, status: { in: ["SCHEDULED", "STARTED"] }, departAt: { lt: endAt }, arriveAt: { gt: startAt } },
    select: { id: true },
  });
  return !trip;
}

export async function quoteRental(req: RentalRequest) {
  await expireStaleHolds();
  const plan = await planRental(req);
  const vehicles = await db.vehicle.findMany({ where: { active: true, allowRental: true }, orderBy: { seats: "asc" } });
  const results = [];
  for (const v of vehicles) {
    const available = await isVehicleFree(db, v.id, plan.startAt, plan.endAt);
    results.push({ vehicle: publicVehicle(v), available, ...priceRental(v, req.rentalType, plan) });
  }
  const { route: _route, ...p } = plan;
  return { plan: { ...p, estimatedKm: plan.km }, results };
}

export async function createRentalBooking(
  input: RentalRequest &
    Channel & {
      userId: string;
      vehicleId: string;
      pickupAddress: string;
      dropAddress?: string;
      passengerName: string;
      passengerPhone: string;
      passengers: number;
    },
) {
  await expireStaleHolds();
  await checkCashAllowed(input);
  const plan = await planRental(input, { allowPast: input.source === "OFFLINE" });
  const vehicle = await db.vehicle.findUnique({ where: { id: input.vehicleId } });
  if (!vehicle || !vehicle.active || !vehicle.allowRental) throw new HttpError(404, "This vehicle is not available.");
  if (input.passengers > vehicle.seats) throw new HttpError(400, `This vehicle seats up to ${vehicle.seats} passengers.`);
  const price = priceRental(vehicle, input.rentalType, plan);
  const hasDrop = input.rentalType === "ONE_WAY" || input.rentalType === "ROUND_TRIP";

  const booking = await db.$transaction(
    async (tx) => {
      if (!(await isVehicleFree(tx, vehicle.id, plan.startAt, plan.endAt))) {
        throw new HttpError(409, "Sorry, this vehicle was just booked for those dates. Please choose another.");
      }
      return tx.booking.create({
        data: {
          code: newBookingCode(),
          userId: input.userId,
          kind: "RENTAL",
          source: input.source ?? "ONLINE",
          vehicleId: vehicle.id,
          rentalType: input.rentalType,
          pickupCity: input.pickupCity,
          dropCity: hasDrop ? input.dropCity : null,
          pickupAddress: input.pickupAddress,
          dropAddress: input.dropAddress || null,
          startAt: plan.startAt,
          endAt: plan.endAt,
          estimatedKm: price.billableKm,
          passengers: input.passengers,
          passengerName: input.passengerName,
          passengerPhone: input.passengerPhone,
          boardingOtp: newOtp(),
          endOtp: newOtp(),
          baseAmount: price.baseAmount,
          taxAmount: price.taxAmount,
          extraCharges: price.extraCharges,
          totalAmount: price.totalAmount,
          ...initialStatus(input),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (booking.status === "CONFIRMED") await onBookingConfirmed(booking.id);
  return booking;
}

// ---------- Lifecycle ----------

/** Current financial year label, e.g. "26-27" for April 2026 – March 2027 (IST). */
function financialYear(d = new Date()) {
  const [y, m] = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

/** Gives a paid booking the next tax invoice number (once). Format: RY/26-27/000001 */
export async function assignInvoiceNo(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (b.invoiceNo || b.paymentStatus !== "PAID") return b.invoiceNo;
  const fy = financialYear();
  return db.$transaction(async (tx) => {
    const c = await tx.counter.upsert({ where: { key: `invoice-${fy}` }, update: { value: { increment: 1 } }, create: { key: `invoice-${fy}`, value: 1 } });
    const invoiceNo = `RY/${fy}/${String(c.value).padStart(6, "0")}`;
    await tx.booking.update({ where: { id: bookingId }, data: { invoiceNo } });
    return invoiceNo;
  });
}

/** Runs after a booking becomes CONFIRMED: invoice number (if paid) and confirmation message. */
export async function onBookingConfirmed(bookingId: string) {
  await assignInvoiceNo(bookingId);
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude });
  const s = serializeBooking(b);
  const when = s.startAt ? fmtDateTime(s.startAt) : "";
  const where = s.trip ? `${s.trip.fromCity} to ${s.trip.toCity}` : `${b.pickupCity}${b.dropCity ? ` to ${b.dropCity}` : ""}`;
  const seats = s.seatNos.length ? `, seats ${s.seatNos.join(",")}` : "";
  await notify(
    b.passengerPhone,
    "BOOKING_CONFIRMED",
    [b.code, where, when, b.boardingOtp],
    `Booking ${b.code} confirmed: ${where}, ${when}${seats}. Boarding OTP ${b.boardingOtp}. ${appUrl()}/booking/${b.code}`,
  );
}

export async function notifyDriverAssigned(bookingIds: string[]) {
  const bookings = await db.booking.findMany({ where: { id: { in: bookingIds }, status: "CONFIRMED" }, include: bookingInclude });
  for (const b of bookings) {
    const s = serializeBooking(b);
    if (!s.driver) continue;
    const track = await trackLink(b.id);
    await notify(
      b.passengerPhone,
      "DRIVER_ASSIGNED",
      [b.code, s.driver.name, s.driver.phone, s.vehicleNumber ?? "", track],
      `Booking ${b.code}: your driver is ${s.driver.name} (${s.driver.phone}), vehicle ${s.vehicleNumber}. Track: ${track}`,
    );
  }
}

// ---------- Cancellation ----------

export function bookingStartTime(b: Booking & { trip?: Trip | null }) {
  return b.kind === "SEAT" ? b.trip?.departAt ?? null : b.startAt;
}

/** What the customer gets back if they cancel now, using the admin's cancellation slabs. */
export function cancellationQuote(b: Booking & { trip?: Trip | null }, slabs: CancellationSlab[], now = new Date()) {
  const start = bookingStartTime(b);
  const allowed =
    ["PENDING", "CONFIRMED"].includes(b.status) && !!start && start > now && !b.boardedAt && !b.startedAt && b.trip?.status !== "STARTED";
  const hoursBefore = start ? (start.getTime() - now.getTime()) / 3600_000 : 0;
  const slab = [...slabs].sort((x, y) => y.minHoursBefore - x.minHoursBefore).find((s) => hoursBefore >= s.minHoursBefore);
  const refundPercent = slab?.refundPercent ?? 0;
  const paid = b.paymentStatus === "PAID";
  // Toll & parking haven't been spent yet, so they are always refunded in full.
  const refund = paid ? b.extraCharges + round(((b.baseAmount + b.taxAmount) * refundPercent) / 100) : 0;
  return { allowed, hoursBefore, refundPercent, refund, charge: paid ? b.totalAmount - refund : 0 };
}

export async function cancelBooking(bookingId: string, opts: { by: "CUSTOMER" | "ADMIN" | "SYSTEM"; refundAmount?: number; note?: string }) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { trip: true } });
  const quote = cancellationQuote(b, (await getSettings()).cancellationSlabs);
  const paid = b.paymentStatus === "PAID";
  const refund = paid ? Math.min(b.totalAmount, Math.max(0, round(opts.refundAmount ?? quote.refund))) : 0;
  await db.$transaction([
    db.bookedSeat.deleteMany({ where: { bookingId } }),
    db.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: opts.by,
        refundAmount: refund,
        cancellationCharge: paid ? b.totalAmount - refund : 0,
        paymentStatus: paid && refund > 0 ? "REFUND_PENDING" : b.paymentStatus,
        adminNote: opts.note ?? b.adminNote,
      },
    }),
  ]);
  await notify(
    b.passengerPhone,
    "BOOKING_CANCELLED",
    [b.code, String(refund)],
    `Booking ${b.code} has been cancelled.${refund ? ` A refund of Rs ${refund} will reach you in 5-7 working days.` : ""}`,
  );
}

// ---------- Links ----------

export async function payLink(bookingId: string) {
  const token = await signToken({ sub: bookingId, typ: "pay" }, `${HOLD_MINUTES + 5}m`);
  return { payToken: token, payUrl: `${appUrl()}/pay/${bookingId}?t=${encodeURIComponent(token)}` };
}

/** Read-only token for one booking: opens its tracking page and invoice without logging in. */
const viewToken = (bookingId: string) => signToken({ sub: bookingId, typ: "view" }, "30d");

/** Public link the passenger can open (or share with family) to follow the vehicle live. */
export async function trackLink(bookingId: string) {
  return `${appUrl()}/track/${bookingId}?t=${encodeURIComponent(await viewToken(bookingId))}`;
}

/** Links added to booking API responses (for the mobile app, which has no web login). */
export async function bookingLinks(b: { id: string; code: string; invoiceNo: string | null }, s: { trackable: boolean }) {
  const t = encodeURIComponent(await viewToken(b.id));
  return {
    trackUrl: s.trackable ? `${appUrl()}/track/${b.id}?t=${t}` : null,
    invoiceUrl: b.invoiceNo ? `${appUrl()}/invoice/${b.code}?t=${t}` : null,
  };
}

/** serializeBooking + links + refund preview: the full booking object returned by the API. */
export async function bookingForApi(b: FullBooking) {
  const s = serializeBooking(b, (await getSettings()).cancellationSlabs);
  return { ...s, ...(await bookingLinks(b, s)) };
}

// ---------- Serialisation ----------

export function publicVehicle(v: Vehicle) {
  return {
    id: v.id,
    name: v.name,
    type: v.type,
    seats: v.seats,
    seatsPerRow: v.seatsPerRow,
    aisleAfter: v.aisleAfter,
    amenities: v.amenities ? v.amenities.split(",").map((a) => a.trim()).filter(Boolean) : [],
    imageUrl: v.imageUrl,
  };
}

export const publicStop = (s: Stop) => ({ id: s.id, city: s.city, name: s.name, address: s.address, lat: s.lat, lng: s.lng });

type DriverWithUser = Driver & { user: User };
type FullBooking = Booking & {
  trip?: (Trip & { route: Route; vehicle: Vehicle; driver: DriverWithUser | null }) | null;
  vehicle?: Vehicle | null;
  driver?: DriverWithUser | null;
  pickupStop?: Stop | null;
  dropStop?: Stop | null;
};

export const bookingInclude = {
  trip: { include: { route: true, vehicle: true, driver: { include: { user: true } } } },
  vehicle: true,
  driver: { include: { user: true } },
  pickupStop: true,
  dropStop: true,
} as const;

/** Booking as the customer sees it (API and pages). Pass the cancellation slabs to include a refund preview. */
export function serializeBooking(b: FullBooking, slabs?: CancellationSlab[]) {
  const vehicle = b.trip?.vehicle ?? b.vehicle ?? null;
  const driver = b.trip?.driver ?? b.driver ?? null;
  const confirmed = b.status === "CONFIRMED";
  const start = b.kind === "SEAT" ? b.trip?.departAt ?? null : b.startAt;
  const tripStatus =
    b.kind === "SEAT" ? b.trip?.status ?? "SCHEDULED" : b.completedAt ? "COMPLETED" : b.startedAt ? "STARTED" : "SCHEDULED";
  const trackable = confirmed && !!driver && !!start && start.getTime() - Date.now() < TRACK_WINDOW_HOURS * 3600_000 && tripStatus !== "COMPLETED";
  const quote = slabs ? cancellationQuote(b, slabs) : null;

  return {
    id: b.id,
    code: b.code,
    kind: b.kind,
    status: b.status,
    source: b.source,
    tripStatus,
    paymentStatus: b.paymentStatus,
    paymentMode: b.paymentMode,
    passengerName: b.passengerName,
    passengerPhone: b.passengerPhone,
    passengers: b.passengers,
    baseAmount: b.baseAmount,
    taxAmount: b.taxAmount,
    extraCharges: b.extraCharges,
    totalAmount: b.totalAmount,
    seatNos: b.seatNos ? b.seatNos.split(",").map(Number) : [],
    pickupStop: b.pickupStop ? publicStop(b.pickupStop) : null,
    dropStop: b.dropStop ? publicStop(b.dropStop) : null,
    rentalType: b.rentalType,
    pickupCity: b.pickupCity,
    dropCity: b.dropCity,
    pickupAddress: b.pickupAddress,
    dropAddress: b.dropAddress,
    startAt: start,
    endAt: b.kind === "SEAT" ? b.trip?.arriveAt ?? null : b.endAt,
    estimatedKm: b.estimatedKm,
    trip: b.trip
      ? {
          id: b.trip.id,
          fromCity: b.trip.route.fromCity,
          toCity: b.trip.route.toCity,
          departAt: b.trip.departAt,
          arriveAt: b.trip.arriveAt,
          boardingPoint: b.trip.boardingPoint,
          dropPoint: b.trip.dropPoint,
        }
      : null,
    vehicle: vehicle ? publicVehicle(vehicle) : null,
    // Shown once a driver is assigned, so the passenger can find the vehicle.
    vehicleNumber: driver && vehicle ? vehicle.regNumber : null,
    driver: driver ? { name: driver.user.name, phone: driver.user.phone, photoUrl: driver.photoUrl } : null,
    // The passenger shows this OTP (or the QR) to the driver when boarding.
    boardingOtp: confirmed && !b.boardedAt && !b.startedAt ? b.boardingOtp : null,
    qrData: confirmed && !b.boardedAt && !b.startedAt ? `RY:${b.code}:${b.boardingOtp}` : null,
    // Rentals: the customer gives this to the driver at the end of the trip.
    endOtp: b.kind === "RENTAL" && b.startedAt && !b.completedAt ? b.endOtp : null,
    boardedAt: b.boardedAt,
    canCancel: quote?.allowed ?? false,
    cancellation: quote?.allowed ? { refundPercent: quote.refundPercent, refundAmount: quote.refund, charge: quote.charge } : null,
    cancelledAt: b.cancelledAt,
    refundAmount: b.refundAmount,
    cancellationCharge: b.cancellationCharge,
    invoiceNo: b.invoiceNo,
    trackable,
    holdExpiresAt: b.status === "PENDING" ? new Date(b.createdAt.getTime() + HOLD_MINUTES * 60_000) : null,
    createdAt: b.createdAt,
  };
}
