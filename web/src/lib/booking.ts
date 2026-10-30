import crypto from "node:crypto";
import { Prisma, type Booking, type BookedSeat, type Trip, type Route, type Vehicle, type VehicleLocation, type Stop, type Driver, type User } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./http";
import { signToken } from "./auth";
import { getSettings, type CancellationSlab } from "./settings";
import { notify } from "./notify";
import { fmtDateTime } from "./format";
import { onlinePaymentsAvailable } from "./payment-mode";
import { womenSeatInfo } from "./ladies";
import { assertRunsOnRoute } from "./fleet";

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

let lastHoldSweep = 0;

/**
 * Releases seats and vehicles held by online bookings that were never paid. Called on most requests, so it runs at
 * most every 15 s per server instance; a hold lasts HOLD_MINUTES, so a few seconds' delay doesn't matter.
 */
export async function expireStaleHolds() {
  if (Date.now() - lastHoldSweep < 15_000) return;
  lastHoldSweep = Date.now();
  const cutoff = new Date(Date.now() - HOLD_MINUTES * 60_000);
  const stale = await db.booking.findMany({ where: { status: "PENDING", createdAt: { lt: cutoff } }, select: { id: true } });
  if (!stale.length) return;
  const ids = stale.map((b) => b.id);
  // Only bookings still PENDING: one that was paid a moment ago must not be expired (nor its seats freed).
  await db.$transaction(async (tx) => {
    await tx.booking.updateMany({ where: { id: { in: ids }, status: "PENDING" }, data: { status: "EXPIRED" } });
    await tx.bookedSeat.deleteMany({ where: { bookingId: { in: ids }, booking: { status: "EXPIRED" } } });
  });
}

/** Finds the customer account for a phone number, creating one for offline (phone/walk-in) bookings. */
export async function findOrCreateCustomer(phone: string, name: string) {
  return (await db.user.findUnique({ where: { phone } })) ?? db.user.create({ data: { phone, name } });
}

/** ADVANCE: pay settings.advancePerSeat online now (Razorpay), the rest in cash to the driver. */
export type PaymentChoice = "ONLINE" | "CASH" | "ADVANCE";

/** Cash the driver still has to collect: everything for UNPAID, the balance after an online advance for PARTIAL. */
export const cashDue = (b: { status: string; paymentStatus: string; totalAmount: number; amountPaid: number }) =>
  b.status === "CANCELLED" ? 0 : b.paymentStatus === "UNPAID" ? b.totalAmount : b.paymentStatus === "PARTIAL" ? Math.max(0, b.totalAmount - b.amountPaid) : 0;
type Channel = { source?: "ONLINE" | "OFFLINE"; payment: PaymentChoice; markPaid?: boolean };

async function checkCashAllowed(c: Channel) {
  if ((c.payment === "ONLINE" || c.payment === "ADVANCE") && c.source !== "OFFLINE" && !onlinePaymentsAvailable()) {
    throw new HttpError(400, "Online payment is not available yet. Please choose Pay cash to driver.");
  }
  if (c.payment === "ADVANCE" && !((await getSettings()).advancePerSeat > 0)) throw new HttpError(400, "Advance payment is not offered right now.");
  if (c.payment === "CASH" && c.source !== "OFFLINE" && !(await getSettings()).allowCash) {
    throw new HttpError(400, "Cash payment is not available right now. Please pay online.");
  }
}

/** Status fields for a new booking: online payments wait for the gateway, cash/offline ones are confirmed now. */
function initialStatus(c: Channel) {
  if (c.payment === "ONLINE" && c.source !== "OFFLINE") return { status: "PENDING", paymentStatus: "UNPAID" };
  if (c.payment === "ADVANCE" && c.source !== "OFFLINE") return { status: "PENDING", paymentStatus: "UNPAID", paymentMode: "ADVANCE" };
  return { status: "CONFIRMED", paymentStatus: c.markPaid ? "PAID" : "UNPAID", paymentMode: "CASH", paidAt: c.markPaid ? new Date() : null };
}

// ---------- Seat booking ----------

const MAX_OPEN_CASH_BOOKINGS = 3;

/**
 * Cash bookings are confirmed without paying, so one account can hold only a few unpaid upcoming ones —
 * otherwise a throwaway account could block every seat. The office (phone bookings) is not limited.
 */
async function checkOpenCashBookings(c: Channel & { userId: string }) {
  if (c.source === "OFFLINE" || c.payment !== "CASH") return;
  const open = await db.booking.count({
    where: { userId: c.userId, status: "CONFIRMED", paymentStatus: "UNPAID", OR: [{ trip: { departAt: { gt: new Date() } } }, { startAt: { gt: new Date() } }] },
  });
  if (open >= MAX_OPEN_CASH_BOOKINGS) throw new HttpError(429, `You already have ${open} unpaid upcoming bookings. Travel or cancel one first, or call us to book more.`);
}

export type SeatPassenger = { seatNo: number; name?: string; phone?: string; female?: boolean };

/**
 * Return-trip discount (Admin → Settings): the customer already holds the onward journey — the reverse route,
 * departing within the 15 days before this trip.
 */
export async function returnDiscount(userId: string, trip: { departAt: Date; route: { fromCity: string; toCity: string } }) {
  const pct = (await getSettings()).returnDiscountPercent;
  if (!(pct > 0)) return 0;
  const onward = await db.booking.findFirst({
    where: {
      userId,
      kind: "SEAT",
      status: { in: ["CONFIRMED", "COMPLETED"] },
      trip: { route: { fromCity: trip.route.toCity, toCity: trip.route.fromCity }, departAt: { lt: trip.departAt, gte: new Date(trip.departAt.getTime() - 15 * 24 * 3600_000) } },
    },
    select: { id: true },
  });
  return onward ? pct : 0;
}

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
    /** Optional: a different traveller per seat (name, WhatsApp number, woman). */
    seatPassengers?: SeatPassenger[];
  },
) {
  await expireStaleHolds();
  await checkCashAllowed(input);
  await checkOpenCashBookings(input);
  const trip = await db.trip.findUnique({ where: { id: input.tripId }, include: { vehicle: true, route: true } });
  if (!trip || trip.status !== "SCHEDULED") throw new HttpError(404, "This trip is not available for booking.");
  // The office can still book a phone customer on it; online customers can't book a vehicle switched off here.
  if (input.source !== "OFFLINE") await assertRunsOnRoute([trip.routeId], trip.vehicleId);
  if (trip.departAt <= new Date()) throw new HttpError(400, "This trip has already departed.");

  const seatNos = [...new Set(input.seatNos)].sort((a, b) => a - b);
  if (!seatNos.length) throw new HttpError(400, "Select at least one seat.");
  if (seatNos.some((s) => s < 1 || s > trip.vehicle.seats)) throw new HttpError(400, "Invalid seat selected.");

  const stops = await db.stop.findMany({ where: { id: { in: [input.pickupStopId, input.dropStopId].filter((x): x is string => !!x) }, active: true } });
  const pickup = stops.find((s) => s.id === input.pickupStopId);
  const drop = stops.find((s) => s.id === input.dropStopId);
  if (input.pickupStopId && pickup?.city !== trip.route.fromCity) throw new HttpError(400, "Choose a pickup point in " + trip.route.fromCity + ".");
  if (input.dropStopId && drop?.city !== trip.route.toCity) throw new HttpError(400, "Choose a drop point in " + trip.route.toCity + ".");

  // Women's seats: a seat next to a woman can only go to a woman.
  const seatInfo = new Map((input.seatPassengers ?? []).filter((p) => seatNos.includes(p.seatNo)).map((p) => [p.seatNo, p]));
  const { womenOnlySeats: womenOnly } = await womenSeatInfo(trip.id, trip.vehicle);
  const blocked = seatNos.filter((n) => womenOnly.includes(n) && !seatInfo.get(n)?.female);
  if (blocked.length) throw new HttpError(400, `Seat ${blocked.join(", ")} is next to a woman passenger and can only be booked for a woman. Tick "Woman" for that seat, or choose another seat.`);

  const discountPercent = await returnDiscount(input.userId, trip);
  const amounts = withTax(trip.fare * seatNos.length * (1 - discountPercent / 100));

  // Two people picking the same seat: the unique (tripId, seatNo) index lets only one booking in. Checking first
  // turns most clashes into a clear answer without waiting on the database lock.
  const seatTaken = () => new HttpError(409, "Sorry, one or more of those seats was just booked by someone else. Please pick again.");
  if (await db.bookedSeat.count({ where: { tripId: trip.id, seatNo: { in: seatNos } } })) throw seatTaken();

  // Booking and its seats in one write, so the seats are locked as briefly as possible.
  const create = () =>
    db.booking.create({
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
        discountPercent,
        ...initialStatus(input),
        ...amounts,
        seats: {
          createMany: {
            data: seatNos.map((seatNo) => {
              const p = seatInfo.get(seatNo);
              return { tripId: trip.id, seatNo, passengerName: p?.name?.trim() || null, passengerPhone: p?.phone || null, female: !!p?.female };
            }),
          },
        },
      },
    });
  let booking: Booking | undefined;
  for (let attempt = 1; !booking; attempt++) {
    try {
      booking = await create();
    } catch (e) {
      const code = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : "";
      if (code === "P2002") throw seatTaken(); // another booking holds one of these seats
      // Write conflict / lock wait / timeout while many people book at once: try once more, then say so plainly.
      if (!["P2034", "P2028", "P1008"].includes(code)) throw e;
      if (await db.bookedSeat.count({ where: { tripId: trip.id, seatNo: { in: seatNos } } })) throw seatTaken();
      if (attempt >= 2) throw new HttpError(503, "Lots of people are booking right now. Please try again in a moment.");
    }
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

/** Ids of a route and its return route (full cabs use either direction). */
export async function routeIdsBetween(r: { fromCity: string; toCity: string }) {
  const rows = await db.route.findMany({ where: { OR: [{ fromCity: r.fromCity, toCity: r.toCity }, { fromCity: r.toCity, toCity: r.fromCity }] }, select: { id: true } });
  return rows.map((x) => x.id);
}

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
  const all = await db.vehicle.findMany({ where: { active: true, allowRental: true }, orderBy: { seats: "asc" } });
  // Vehicles the office switched off on this route (either direction) aren't offered for it.
  const offIds = plan.route ? new Set((await db.routeVehicleOff.findMany({ where: { routeId: { in: await routeIdsBetween(plan.route) } } })).map((o) => o.vehicleId)) : new Set<string>();
  const vehicles = all.filter((v) => !offIds.has(v.id));
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
      pickupLat?: number;
      pickupLng?: number;
      passengerName: string;
      passengerPhone: string;
      passengers: number;
    },
) {
  await expireStaleHolds();
  if (input.payment === "ADVANCE") throw new HttpError(400, "Advance payment is only for shared seats. Please pay online or in cash.");
  await checkOpenCashBookings(input);
  // Keep hires to sensible dates so a booking can't lock a vehicle for months.
  if (input.source !== "OFFLINE") {
    if (input.startAt.getTime() > Date.now() + 90 * 24 * 3600_000) throw new HttpError(400, "Online bookings open up to 90 days ahead. Please call us for later dates.");
    if (input.returnAt && input.returnAt.getTime() - input.startAt.getTime() > 30 * 24 * 3600_000) throw new HttpError(400, "Online round trips can be up to 30 days. Please call us for longer hires.");
  }
  await checkCashAllowed(input);
  const plan = await planRental(input, { allowPast: input.source === "OFFLINE" });
  const vehicle = await db.vehicle.findUnique({ where: { id: input.vehicleId } });
  if (!vehicle || !vehicle.active || !vehicle.allowRental) throw new HttpError(404, "This vehicle is not available.");
  if (plan.route && input.source !== "OFFLINE") await assertRunsOnRoute(await routeIdsBetween(plan.route), vehicle.id);
  if (input.passengers > vehicle.seats) throw new HttpError(400, `This vehicle seats up to ${vehicle.seats} passengers.`);
  const price = priceRental(vehicle, input.rentalType, plan);
  const hasDrop = input.rentalType === "ONE_WAY" || input.rentalType === "ROUND_TRIP";

  const booking = await db
    .$transaction(
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
          // Only a complete pin is kept.
          ...(input.pickupLat != null && input.pickupLng != null ? { pickupLat: input.pickupLat, pickupLng: input.pickupLng } : {}),
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
    )
    .catch((e) => {
      // Two people holding the same cab at the same moment: Postgres aborts one of the serializable transactions.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") throw new HttpError(409, "Sorry, this vehicle was just booked for those dates. Please choose another.");
      throw e;
    });
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
class InvoiceTaken extends Error {}

export async function assignInvoiceNo(bookingId: string): Promise<string | null> {
  try {
    return await assignInvoiceNoOnce(bookingId);
  } catch (e) {
    if (e instanceof InvoiceTaken) return (await db.booking.findUnique({ where: { id: bookingId }, select: { invoiceNo: true } }))?.invoiceNo ?? null;
    throw e;
  }
}

async function assignInvoiceNoOnce(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (b.invoiceNo || b.paymentStatus !== "PAID") return b.invoiceNo;
  const fy = financialYear();
  return db.$transaction(async (tx) => {
    const c = await tx.counter.upsert({ where: { key: `invoice-${fy}` }, update: { value: { increment: 1 } }, create: { key: `invoice-${fy}`, value: 1 } });
    const invoiceNo = `RY/${fy}/${String(c.value).padStart(6, "0")}`;
    // Claim it only if no one else numbered this booking meanwhile (a retry must not re-number an issued invoice).
    const { count } = await tx.booking.updateMany({ where: { id: bookingId, invoiceNo: null }, data: { invoiceNo } });
    if (!count) throw new InvoiceTaken();
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
  // The booker, and every traveller who was given their own WhatsApp number, gets the ticket.
  for (const phone of [b.passengerPhone, ...otherPhones(b)])
    await notify(
      phone,
      "BOOKING_CONFIRMED",
      [b.code, where, when, b.boardingOtp],
      `Booking ${b.code} confirmed: ${where}, ${when}${seats}. Boarding OTP ${b.boardingOtp}. ${appUrl()}/booking/${b.code}`,
    );
}

/** WhatsApp numbers of the other travellers on a booking (given per seat), without the booker's own. */
export const otherPhones = (b: { passengerPhone: string; seats?: BookedSeat[] }) => [
  ...new Set((b.seats ?? []).map((s) => s.passengerPhone).filter((p): p is string => !!p && p !== b.passengerPhone)),
];

export async function notifyDriverAssigned(bookingIds: string[]) {
  const bookings = await db.booking.findMany({ where: { id: { in: bookingIds }, status: "CONFIRMED" }, include: bookingInclude });
  for (const b of bookings) {
    const s = serializeBooking(b);
    if (!s.driver) continue;
    const track = await trackLink(b.id);
    for (const phone of [b.passengerPhone, ...otherPhones(b)])
    await notify(
      phone,
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
  const advance = b.paymentStatus === "PARTIAL" ? b.amountPaid : 0;
  // Toll & parking haven't been spent yet, so they are always refunded in full. An online advance follows the same slab.
  const refund = paid ? b.extraCharges + round(((b.baseAmount + b.taxAmount) * refundPercent) / 100) : round((advance * refundPercent) / 100);
  return { allowed, hoursBefore, refundPercent, refund, charge: paid ? b.totalAmount - refund : advance - refund };
}

export async function cancelBooking(bookingId: string, opts: { by: "CUSTOMER" | "ADMIN" | "SYSTEM"; refundAmount?: number; note?: string }) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { trip: true } });
  const quote = cancellationQuote(b, (await getSettings()).cancellationSlabs);
  // Money received online so far: everything (PAID) or the advance (PARTIAL).
  const received = b.paymentStatus === "PAID" ? b.totalAmount : b.paymentStatus === "PARTIAL" ? b.amountPaid : 0;
  const paid = received > 0;
  const refund = paid ? Math.min(received, Math.max(0, round(opts.refundAmount ?? quote.refund))) : 0;
  if (b.status !== "PENDING" && b.status !== "CONFIRMED") throw new HttpError(400, `This booking is already ${b.status.toLowerCase()}.`);
  // Claim the cancellation atomically: a double tap (or a stale admin page) must not cancel twice and wipe the refund.
  const claimed = await db.$transaction(async (tx) => {
    const { count } = await tx.booking.updateMany({
      where: { id: bookingId, status: { in: ["PENDING", "CONFIRMED"] } },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: opts.by,
        // Add to (not overwrite) any refund already owed for seats cancelled earlier.
        refundAmount: refund + b.seatRefundDue,
        seatRefundDue: 0,
        cancellationCharge: paid ? received - refund : 0,
        paymentStatus: refund + b.seatRefundDue > 0 ? "REFUND_PENDING" : b.paymentStatus,
        adminNote: opts.note ?? b.adminNote,
      },
    });
    if (count) await tx.bookedSeat.deleteMany({ where: { bookingId } });
    return count > 0;
  });
  if (!claimed) throw new HttpError(400, "This booking was just cancelled.");
  await notify(
    b.passengerPhone,
    "BOOKING_CANCELLED",
    [b.code, String(refund)],
    `Booking ${b.code} has been cancelled.${refund ? ` A refund of Rs ${refund} will reach you in 5-7 working days.` : ""}`,
  );
}

/**
 * Cancels some of the seats on a shared-seat booking (one traveller's plans changed). The refund for those
 * seats follows the same slabs as a full cancellation. Cancelling every seat cancels the booking.
 */
export async function cancelSeats(bookingId: string, seatNos: number[]) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { trip: true } });
  if (b.kind !== "SEAT" || !b.trip) throw new HttpError(400, "Only shared-seat bookings can cancel single seats.");
  const current = b.seatNos ? b.seatNos.split(",").map(Number) : [];
  const drop = [...new Set(seatNos)].filter((n) => current.includes(n));
  if (!drop.length) throw new HttpError(400, "Choose the seats to cancel.");
  if (drop.length >= current.length) return cancelBooking(bookingId, { by: "CUSTOMER", note: "Cancelled by customer" });
  // An issued GST invoice can't be changed in place (it needs a credit note): the office handles those.
  if (b.invoiceNo) throw new HttpError(400, "This booking already has a tax invoice. Please call us to cancel some of its seats.");
  const settings = await getSettings();
  const quote = cancellationQuote(b, settings.cancellationSlabs);
  if (!quote.allowed) throw new HttpError(400, "This booking can no longer be cancelled online. Please call us.");

  const keep = current.filter((n) => !drop.includes(n));
  const amounts = withTax(b.trip.fare * keep.length * (1 - b.discountPercent / 100));
  const removed = b.baseAmount + b.taxAmount - (amounts.baseAmount + amounts.taxAmount);
  // Paid in full: refund the slab share of the removed seats. Paid an advance: refund only what now exceeds the new total.
  const refund =
    b.paymentStatus === "PAID" ? round((removed * quote.refundPercent) / 100) : b.paymentStatus === "PARTIAL" ? Math.max(0, b.amountPaid - amounts.totalAmount) : 0;
  const advanceCovers = b.paymentStatus === "PARTIAL" && b.amountPaid >= amounts.totalAmount;
  await db.$transaction([
    db.bookedSeat.deleteMany({ where: { bookingId, seatNo: { in: drop } } }),
    db.booking.update({
      where: { id: bookingId },
      data: {
        seatNos: keep.join(","),
        passengers: keep.length,
        ...amounts,
        // The booking keeps going, so its payment status stays; the refund waits in seatRefundDue for the office.
        ...(refund > 0 ? { seatRefundDue: { increment: refund } } : {}),
        ...(advanceCovers ? { amountPaid: amounts.totalAmount, paymentStatus: "PAID" } : {}),
        adminNote: [b.adminNote, `Seat ${drop.join(", ")} cancelled by customer${refund ? ` (refund Rs ${refund})` : ""}.`].filter(Boolean).join(" "),
      },
    }),
  ]);
  await notify(
    b.passengerPhone,
    "BOOKING_CANCELLED",
    [b.code, String(refund)],
    `Booking ${b.code}: seat ${drop.join(", ")} cancelled, seat ${keep.join(", ")} still booked.${refund ? ` Refund of Rs ${refund} is on its way.` : ""}`,
  );
}

/**
 * Free change (Admin → Settings → hours): move a shared-seat booking to another trip on the same route once,
 * and/or change its pickup / drop point. Seats are re-chosen on the new trip; the women's seat rule applies.
 */
export async function changeBooking(
  bookingId: string,
  input: { tripId?: string; seatNos?: number[]; seatPassengers?: SeatPassenger[]; pickupStopId?: string; dropStopId?: string },
) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude });
  const settings = await getSettings();
  const w = changeWindow(b, settings.freeChangeHours);
  if (!b.trip) throw new HttpError(400, "Only shared-seat bookings can be changed here. Please call us for a full cab.");
  const data: Prisma.BookingUncheckedUpdateInput = {};
  let newTrip = b.trip as Trip & { route: Route; vehicle: Vehicle };

  if (input.tripId && input.tripId !== b.tripId) {
    if (!w.canChangeDate) throw new HttpError(400, b.changeCount ? "This booking has already used its free date change." : `Changes are allowed up to ${settings.freeChangeHours} hours before departure.`);
    const t = await db.trip.findUnique({ where: { id: input.tripId }, include: { route: true, vehicle: true } });
    if (!t || t.status !== "SCHEDULED" || t.departAt <= new Date()) throw new HttpError(400, "That trip is not available.");
    if (t.route.fromCity !== b.trip.route.fromCity || t.route.toCity !== b.trip.route.toCity) throw new HttpError(400, "You can only move to a trip on the same route.");
    const seatNos = [...new Set(input.seatNos ?? [])].sort((x, y) => x - y);
    const count = b.seatNos ? b.seatNos.split(",").length : 0;
    if (seatNos.length !== count) throw new HttpError(400, `Choose ${count} seat${count > 1 ? "s" : ""} on the new trip.`);
    if (seatNos.some((s) => s < 1 || s > t.vehicle.seats)) throw new HttpError(400, "Invalid seat selected.");
    const amounts = withTax(t.fare * count * (1 - b.discountPercent / 100));
    if (b.paymentStatus !== "UNPAID" && amounts.totalAmount !== b.totalAmount) throw new HttpError(400, "The fare on that trip is different. Please call the office to change a paid booking.");
    newTrip = t;
    Object.assign(data, { tripId: t.id, seatNos: seatNos.join(","), ...amounts, changedAt: new Date(), nearNotifiedAt: null });
    // Travellers keep their details, in seat order.
    const old = (b.seats ?? []).filter((s) => s.bookingId).sort((x, y) => x.seatNo - y.seatNo);
    const given = new Map((input.seatPassengers ?? []).map((p) => [p.seatNo, p]));
    const rows = seatNos.map((seatNo, i) => {
      const was = { name: old[i]?.passengerName ?? undefined, phone: old[i]?.passengerPhone ?? undefined, female: old[i]?.female };
      const g = given.get(seatNo);
      const p = g ? { name: g.name || was.name, phone: g.phone || was.phone, female: g.female ?? was.female } : was;
      return { tripId: t.id, seatNo, bookingId: b.id, passengerName: p.name || null, passengerPhone: p.phone || null, female: !!p.female };
    });
    const { womenOnlySeats: womenOnly } = await womenSeatInfo(t.id, t.vehicle);
    const blocked = rows.filter((r) => womenOnly.includes(r.seatNo) && !r.female).map((r) => r.seatNo);
    if (blocked.length) throw new HttpError(400, `Seat ${blocked.join(", ")} is next to a woman passenger and can only be booked for a woman.`);
    try {
      await db.$transaction(async (tx) => {
        // Claim the one free change first, so two taps at once can't both move the booking.
        const { count } = await tx.booking.updateMany({ where: { id: b.id, changeCount: b.changeCount }, data: { changeCount: { increment: 1 } } });
        if (!count) throw new HttpError(409, "This booking was just changed. Please reopen it.");
        await tx.bookedSeat.deleteMany({ where: { bookingId: b.id } });
        await tx.bookedSeat.createMany({ data: rows });
        await tx.booking.update({ where: { id: b.id }, data: { tripId: t.id, seatNos: seatNos.join(",") } });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError(409, "One of those seats was just booked. Please pick again.");
      if (e instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2028", "P1008"].includes(e.code))
        throw new HttpError(503, "Lots of people are booking right now. Please try again in a moment.");
      throw e;
    }
  }

  for (const [key, id, city] of [
    ["pickupStopId", input.pickupStopId, newTrip.route.fromCity],
    ["dropStopId", input.dropStopId, newTrip.route.toCity],
  ] as const) {
    if (!id || id === b[key]) continue;
    if (!w.canChangePickup) throw new HttpError(400, `Changes are allowed up to ${settings.freeChangeHours} hours before departure.`);
    const stop = await db.stop.findUnique({ where: { id } });
    if (!stop?.active || stop.city !== city) throw new HttpError(400, `Choose a point in ${city}.`);
    data[key] = id;
  }
  if (!Object.keys(data).length) throw new HttpError(400, "Nothing to change.");

  const updated = await db.booking.update({ where: { id: b.id }, data, include: bookingInclude });
  const s = serializeBooking(updated);
  const where = `${newTrip.route.fromCity} to ${newTrip.route.toCity}`;
  const when = s.startAt ? fmtDateTime(s.startAt) : "";
  const pickup = updated.pickupStop?.name ?? "";
  for (const phone of [updated.passengerPhone, ...otherPhones(updated)])
    await notify(phone, "BOOKING_CHANGED", [b.code, where, when, pickup], `Booking ${b.code} changed: ${where}, ${when}${s.seatNos.length ? `, seats ${s.seatNos.join(",")}` : ""}${pickup ? `, pickup ${pickup}` : ""}.`);
  return updated;
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

/** serializeBooking + links + refund preview + change window + live ETA: the full booking object returned by the API. */
export async function bookingForApi(b: FullBooking) {
  const settings = await getSettings();
  const s = serializeBooking(b, settings.cancellationSlabs);
  return { ...s, ...changeWindow(b, settings.freeChangeHours), ...vehicleEta(b), ...(await bookingLinks(b, s)) };
}

const LATE_AFTER_MIN = 10;

/**
 * A confirmed shared-seat booking can move to another date once, and change pickup / drop any number of times,
 * up to settings.freeChangeHours before departure.
 */
export function changeWindow(b: FullBooking, freeChangeHours: number) {
  const start = b.trip?.departAt;
  const open =
    freeChangeHours > 0 && b.kind === "SEAT" && b.status === "CONFIRMED" && !b.boardedAt && b.trip?.status === "SCHEDULED" && !!start &&
    start.getTime() - Date.now() > freeChangeHours * 3600_000;
  return {
    canChangePickup: open,
    canChangeDate: open && b.changeCount === 0,
    changeDeadline: start && freeChangeHours > 0 ? new Date(start.getTime() - freeChangeHours * 3600_000) : null,
  };
}

/** From this long before pickup, a passenger can share their live location with the driver (until they board). */
export const SHARE_LOCATION_HOURS = 3;

/** Whether the passenger may share their live location now: a confirmed booking around pickup time, not yet on board. */
export function canShareLocation(b: FullBooking) {
  if (b.status !== "CONFIRMED" || b.boardedAt || b.startedAt || b.noShow) return false;
  if (b.trip && b.trip.status !== "SCHEDULED" && b.trip.status !== "STARTED") return false;
  const start = b.kind === "SEAT" ? b.trip?.departAt : b.startAt;
  if (!start) return false;
  const t = Date.now() - start.getTime();
  return t > -SHARE_LOCATION_HOURS * 3600_000 && t < SHARE_LOCATION_HOURS * 3600_000;
}

/** How far the vehicle is from the passenger's pickup point, while the trip is under way and they haven't boarded. */
function vehicleEta(b: FullBooking) {
  const loc = b.trip?.vehicle.location;
  const stop = b.pickupStop;
  const fresh = loc && Date.now() - loc.updatedAt.getTime() < 10 * 60_000;
  if (b.trip?.status !== "STARTED" || b.boardedAt || !fresh || stop?.lat == null || stop.lng == null) return { vehicleKm: null, etaMinutes: null };
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(stop.lat - loc.lat) / 2) ** 2 + Math.cos(r(loc.lat)) * Math.cos(r(stop.lat)) * Math.sin(r(stop.lng - loc.lng) / 2) ** 2;
  const km = 12742 * Math.asin(Math.sqrt(h)) * 1.3; // roads are longer than a straight line
  return { vehicleKm: Math.round(km * 10) / 10, etaMinutes: Math.max(1, Math.round((km / 35) * 60)) };
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
    seatLayout: v.seatLayout,
    amenities: v.amenities ? v.amenities.split(",").map((a) => a.trim()).filter(Boolean) : [],
    imageUrl: v.imageUrl,
  };
}

export const publicStop = (s: Stop) => ({ id: s.id, city: s.city, name: s.name, address: s.address, landmark: s.landmark, photoUrl: s.photoUrl, lat: s.lat, lng: s.lng });

type DriverWithUser = Driver & { user: User };
type FullBooking = Booking & {
  trip?: (Trip & { route: Route; vehicle: Vehicle & { location?: VehicleLocation | null }; driver: DriverWithUser | null }) | null;
  seats?: BookedSeat[];
  vehicle?: (Vehicle & { location?: VehicleLocation | null }) | null;
  driver?: DriverWithUser | null;
  pickupStop?: Stop | null;
  dropStop?: Stop | null;
};

export const bookingInclude = {
  trip: { include: { route: true, vehicle: { include: { location: true } }, driver: { include: { user: true } } } },
  seats: { orderBy: { seatNo: "asc" } },
  vehicle: { include: { location: true } },
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
    seatPassengers: (b.seats ?? []).filter((s) => s.bookingId).map((s) => ({ seatNo: s.seatNo, name: s.passengerName, phone: s.passengerPhone, female: s.female })),
    pickupStop: b.pickupStop ? publicStop(b.pickupStop) : null,
    dropStop: b.dropStop ? publicStop(b.dropStop) : null,
    discountPercent: b.discountPercent,
    amountPaid: b.amountPaid,
    // What is still to be paid in cash to the driver (all of it, or the balance after an online advance).
    cashDue: cashDue(b),
    changeCount: b.changeCount,
    // Departure time passed and the trip hasn't started.
    runningLate: confirmed && tripStatus === "SCHEDULED" && !!start && Date.now() - start.getTime() > LATE_AFTER_MIN * 60_000,
    rentalType: b.rentalType,
    pickupCity: b.pickupCity,
    dropCity: b.dropCity,
    pickupAddress: b.pickupAddress,
    dropAddress: b.dropAddress,
    // Exact pickup pin (full cab), and the live location the passenger is sharing with the driver, if any.
    pickupPin: b.pickupLat != null && b.pickupLng != null ? { lat: b.pickupLat, lng: b.pickupLng } : null,
    sharedLocation: b.passengerLat != null && b.passengerLng != null && b.passengerLocAt ? { lat: b.passengerLat, lng: b.passengerLng, at: b.passengerLocAt } : null,
    canShareLocation: canShareLocation(b),
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
    // Shown as soon as the booking is confirmed (a shared trip has its vehicle fixed), like a ride app shows the plate.
    vehicleNumber: vehicle && (b.status === "CONFIRMED" || b.status === "COMPLETED") ? vehicle.regNumber : null,
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
    rating: b.rating,
    // A passenger who travelled can rate the trip once, within two weeks.
    canRate: b.status === "COMPLETED" && !b.noShow && b.rating == null && !!b.completedAt && Date.now() - b.completedAt.getTime() < 14 * 24 * 3600_000,
    holdExpiresAt: b.status === "PENDING" ? new Date(b.createdAt.getTime() + HOLD_MINUTES * 60_000) : null,
    createdAt: b.createdAt,
  };
}
