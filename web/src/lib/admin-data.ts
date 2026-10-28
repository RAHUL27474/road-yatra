import type { Driver, Prisma, Route, Trip, User, Vehicle } from "@prisma/client";
import { db } from "./db";
import { bookingInclude, bookingLinks, cancellationQuote, cashDue, expireStaleHolds, publicStop, serializeBooking } from "./booking";
import { BLOCK_REASONS, inr, RENTAL_TYPES, VEHICLE_TYPES } from "./format";
import { isOffIn, offPairs } from "./fleet";
import { getSettings } from "./settings";
import { privateFileUrl } from "./uploads";
import { buildReport, REPORTS } from "./reports";
import { isDemoPayments } from "./payment";
import { otpAvailable } from "./otp";
import { WHATSAPP_TEMPLATES } from "./notify";

/** Data behind each admin page, as JSON for the mobile app (same queries as app/admin/**). */

const DOC_WARN_DAYS = 30;
const LIVE_MIN = 10;

const istDay = (now = new Date()) => {
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const dayStart = new Date(`${todayStr}T00:00:00+05:30`);
  return { todayStr, dayStart, dayEnd: new Date(dayStart.getTime() + 24 * 3600_000) };
};

// ---------- Rows ----------

export const vehicleRow = (v: Vehicle) => ({
  id: v.id,
  name: v.name,
  type: v.type,
  typeLabel: VEHICLE_TYPES[v.type] ?? v.type,
  regNumber: v.regNumber,
  seats: v.seats,
  seatsPerRow: v.seatsPerRow,
  aisleAfter: v.aisleAfter,
  seatLayout: v.seatLayout,
  amenities: v.amenities,
  imageUrl: v.imageUrl,
  allowSeatBooking: v.allowSeatBooking,
  allowRental: v.allowRental,
  ratePerKm: v.ratePerKm,
  minKmPerDay: v.minKmPerDay,
  driverAllowance: v.driverAllowance,
  localPackage: v.localPackage,
  airportFare: v.airportFare,
  tollFactor: v.tollFactor,
  insuranceExpiry: v.insuranceExpiry,
  permitExpiry: v.permitExpiry,
  fitnessExpiry: v.fitnessExpiry,
  pucExpiry: v.pucExpiry,
  active: v.active,
});

export const driverRow = (d: Driver & { user: User }) => ({
  id: d.id,
  userId: d.userId,
  name: d.user.name,
  phone: d.user.phone,
  status: d.status,
  active: d.active,
  licenceNo: d.licenceNo,
  licenceExpiry: d.licenceExpiry,
  photoUrl: d.photoUrl,
  licencePhotoUrl: d.licencePhoto ? privateFileUrl(d.licencePhoto) : null,
  aadhaarPhotoUrl: d.aadhaarPhoto ? privateFileUrl(d.aadhaarPhoto) : null,
  aadhaarLast4: d.aadhaarLast4,
  address: d.address,
  experienceYears: d.experienceYears,
  emergencyContact: d.emergencyContact,
  showOnWebsite: d.showOnWebsite,
  notes: d.notes,
  appliedAt: d.appliedAt,
  reviewedAt: d.reviewedAt,
  rejectReason: d.rejectReason,
});

const driverBrief = (d: (Driver & { user: User }) | null) => (d ? { id: d.id, name: d.user.name, phone: d.user.phone } : null);

type TripWith = Trip & { route: Route; vehicle: Vehicle; driver: (Driver & { user: User }) | null; _count?: { seats: number } };
export const tripRow = (t: TripWith) => ({
  id: t.id,
  routeId: t.routeId,
  fromCity: t.route.fromCity,
  toCity: t.route.toCity,
  departAt: t.departAt,
  arriveAt: t.arriveAt,
  fare: t.fare,
  boardingPoint: t.boardingPoint,
  status: t.status,
  vehicle: { id: t.vehicle.id, name: t.vehicle.name, regNumber: t.vehicle.regNumber, seats: t.vehicle.seats },
  driver: driverBrief(t.driver),
  driverResponse: t.driverResponse,
  driverNote: t.driverNote,
  seatsTaken: t._count?.seats ?? 0,
});

const activeDrivers = () => db.driver.findMany({ where: { active: true, status: "APPROVED" }, include: { user: true }, orderBy: { createdAt: "asc" } });

// ---------- Dashboard ----------

/** Money received since `from` (see app/admin/page.tsx). */
async function received(from: Date) {
  const [paid, advances, cash] = await Promise.all([
    db.booking.findMany({
      where: { paymentStatus: { in: ["PAID", "REFUND_PENDING", "REFUNDED"] }, paidAt: { gte: from }, cashCollected: 0, paymentMode: { not: "ADVANCE" } },
      select: { totalAmount: true },
    }),
    db.booking.findMany({ where: { paymentMode: "ADVANCE", paidAt: { gte: from }, amountPaid: { gt: 0 }, status: { not: "PENDING" } }, select: { amountPaid: true } }),
    db.booking.findMany({ where: { cashCollectedAt: { gte: from } }, select: { cashCollected: true } }),
  ]);
  const amount = paid.reduce((n, b) => n + b.totalAmount, 0) + advances.reduce((n, b) => n + b.amountPaid, 0) + cash.reduce((n, b) => n + b.cashCollected, 0);
  return { amount, count: paid.length + advances.length + cash.length };
}

export async function adminDashboard() {
  await expireStaleHolds();
  const now = new Date();
  const { todayStr, dayStart, dayEnd } = istDay(now);
  const monthStart = new Date(`${todayStr.slice(0, 7)}-01T00:00:00+05:30`);
  const warnBy = new Date(Date.now() + DOC_WARN_DAYS * 24 * 3600_000);

  const [todayPaid, monthPaid, todayBookings, refundsPending, cashDueList, todaysTrips, todaysRentals, recent, vehicles, drivers, pendingDrivers, sos, driverCash] =
    await Promise.all([
      received(dayStart),
      received(monthStart),
      db.booking.groupBy({ by: ["kind"], where: { createdAt: { gte: dayStart }, status: { in: ["CONFIRMED", "COMPLETED"] } }, _count: true }),
      db.booking.count({ where: { OR: [{ paymentStatus: "REFUND_PENDING" }, { seatRefundDue: { gt: 0 } }] } }),
      db.booking.findMany({
        where: { status: { in: ["CONFIRMED", "COMPLETED"] }, OR: [{ paymentMode: "CASH", paymentStatus: "UNPAID" }, { paymentStatus: "PARTIAL" }] },
        select: { status: true, paymentStatus: true, totalAmount: true, amountPaid: true },
      }),
      db.trip.findMany({
        where: { status: { in: ["SCHEDULED", "STARTED", "COMPLETED"] }, departAt: { gte: dayStart, lt: dayEnd } },
        include: { route: true, vehicle: true, driver: { include: { user: true } }, _count: { select: { seats: true } } },
        orderBy: { departAt: "asc" },
      }),
      db.booking.findMany({ where: { kind: "RENTAL", status: { in: ["CONFIRMED", "COMPLETED"] }, startAt: { gte: dayStart, lt: dayEnd } }, include: bookingInclude, orderBy: { startAt: "asc" } }),
      db.booking.findMany({ where: { status: { not: "EXPIRED" } }, include: bookingInclude, orderBy: { createdAt: "desc" }, take: 8 }),
      db.vehicle.findMany({ where: { active: true } }),
      activeDrivers(),
      db.driver.count({ where: { status: "PENDING" } }),
      db.sosAlert.findMany({ where: { resolvedAt: null }, include: { driver: { include: { user: true } } }, orderBy: { createdAt: "desc" } }),
      db.booking.aggregate({ where: { cashCollectedBy: { not: null }, cashHandedOverAt: null, cashCollected: { gt: 0 } }, _sum: { cashCollected: true }, _count: true }),
    ]);

  const alerts: { what: string; date: Date; expired: boolean }[] = [];
  for (const v of vehicles) {
    for (const [label, d] of [["Insurance", v.insuranceExpiry], ["Permit", v.permitExpiry], ["Fitness", v.fitnessExpiry], ["PUC", v.pucExpiry]] as const) {
      if (d && d < warnBy) alerts.push({ what: `${v.regNumber} · ${label}`, date: d, expired: d < now });
    }
  }
  for (const d of drivers) if (d.licenceExpiry && d.licenceExpiry < warnBy) alerts.push({ what: `${d.user.name} · Driving licence`, date: d.licenceExpiry, expired: d.licenceExpiry < now });
  alerts.sort((a, b) => a.date.getTime() - b.date.getTime());

  const seatsToday = todaysTrips.reduce((n, t) => n + t.vehicle.seats, 0);
  const soldToday = todaysTrips.reduce((n, t) => n + t._count.seats, 0);
  const count = (k: string) => todayBookings.find((g) => g.kind === k)?._count ?? 0;
  const cashDueTotal = cashDueList.reduce((n, b) => n + cashDue(b), 0);

  const stats = [
    { key: "collectedToday", label: "Collected today", value: inr(todayPaid.amount), amount: todayPaid.amount, sub: `${todayPaid.count} payment(s)` },
    { key: "collectedMonth", label: "Collected this month", value: inr(monthPaid.amount), amount: monthPaid.amount, sub: `${monthPaid.count} payment(s)` },
    { key: "bookingsToday", label: "Bookings today", value: String(count("SEAT") + count("RENTAL")), amount: count("SEAT") + count("RENTAL"), sub: `${count("SEAT")} shared · ${count("RENTAL")} full cab` },
    {
      key: "occupancyToday",
      label: "Seat occupancy today",
      value: seatsToday ? `${Math.round((soldToday / seatsToday) * 100)}%` : "—",
      amount: seatsToday ? Math.round((soldToday / seatsToday) * 100) : 0,
      sub: `${soldToday}/${seatsToday} seats`,
    },
    { key: "cashToCollect", label: "Cash to collect", value: inr(cashDueTotal), amount: cashDueTotal, sub: `${cashDueList.length} booking(s)` },
    {
      key: "cashWithDrivers",
      label: "Cash with drivers",
      value: inr(driverCash._sum.cashCollected ?? 0),
      amount: driverCash._sum.cashCollected ?? 0,
      sub: `${driverCash._count} booking(s) not handed over`,
    },
    { key: "refundsPending", label: "Refunds pending", value: String(refundsPending), amount: refundsPending, sub: refundsPending ? "needs action" : "all clear" },
  ];

  return {
    stats,
    sos: sos.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      driverName: a.driver.user.name,
      driverPhone: a.driver.user.phone,
      vehicleReg: a.vehicleReg,
      lat: a.lat,
      lng: a.lng,
      mapUrl: a.lat != null && a.lng != null ? `https://maps.google.com/?q=${a.lat},${a.lng}` : null,
    })),
    pendingDrivers,
    alerts,
    todaysTrips: todaysTrips.map(tripRow),
    todaysRentals: todaysRentals.map((b) => ({
      ...serializeBooking(b),
      vehicleReg: b.vehicle?.regNumber ?? null,
      driverId: b.driverId,
      driverResponse: b.driverResponse,
      driverNote: b.driverNote,
    })),
    recent: recent.map((b) => serializeBooking(b)),
  };
}

// ---------- Bookings ----------

export const BOOKING_STATUSES = ["ALL", "CONFIRMED", "PENDING", "COMPLETED", "CANCELLED", "EXPIRED"];

type AdminBookingRow = Prisma.BookingGetPayload<{ include: typeof bookingInclude & { user: true } }>;

async function adminBooking(row: AdminBookingRow, slabs: Awaited<ReturnType<typeof getSettings>>["cancellationSlabs"]) {
  const b = serializeBooking(row);
  const links = await bookingLinks(row, b);
  const quote = cancellationQuote(row, slabs);
  return {
    ...b,
    ...links,
    vehicleReg: row.trip?.vehicle.regNumber ?? row.vehicle?.regNumber ?? null,
    driverId: row.trip ? row.trip.driverId : row.driverId,
    driverResponse: row.trip ? row.trip.driverResponse : row.driverResponse,
    driverNote: row.trip ? row.trip.driverNote : row.driverNote,
    bookedBy: { name: row.user.name, phone: row.user.phone },
    createdAt: row.createdAt,
    paymentId: row.paymentId,
    noShow: row.noShow,
    startOdometer: row.startOdometer,
    endOdometer: row.endOdometer,
    adminNote: row.adminNote,
    seatRefundDue: row.seatRefundDue,
    suggestedRefund: row.paymentStatus === "PAID" ? quote.refund : 0,
    // Which buttons the website shows for this booking.
    can: {
      cashOrUpi: (b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL") && b.status === "CONFIRMED",
      complete: b.status === "CONFIRMED",
      markRefunded: b.paymentStatus === "REFUND_PENDING",
      seatRefunded: row.seatRefundDue > 0,
      assignDriver: b.kind === "RENTAL" && b.status === "CONFIRMED" && b.tripStatus !== "COMPLETED",
      cancel: b.status === "CONFIRMED" || b.status === "PENDING",
      refundAmount: row.paymentStatus === "PAID",
    },
  };
}

export async function adminBookings(p: { status?: string; kind?: string; q?: string }) {
  const status = p.status || "ALL";
  const kind = p.kind || "ALL";
  const q = (p.q || "").trim();
  await expireStaleHolds();
  const where: Prisma.BookingWhereInput = {};
  if (status !== "ALL") where.status = status;
  if (kind !== "ALL") where.kind = kind;
  if (q) {
    const title = q.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    const names = [...new Set([q, q.toLowerCase(), q.toUpperCase(), title])].map((n) => ({ passengerName: { contains: n } }));
    where.OR = [{ code: { contains: q.toUpperCase() } }, ...names, { passengerPhone: { contains: q } }];
  }
  const [rows, drivers, settings] = await Promise.all([
    db.booking.findMany({ where, include: { ...bookingInclude, user: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    activeDrivers(),
    getSettings(),
  ]);
  return {
    bookings: await Promise.all(rows.map((r) => adminBooking(r, settings.cancellationSlabs))),
    drivers: drivers.map((d) => ({ id: d.id, name: d.user.name, phone: d.user.phone })),
    statuses: BOOKING_STATUSES,
  };
}

export async function adminBookingDetail(idOrCode: string) {
  await expireStaleHolds();
  const row = await db.booking.findFirst({ where: { OR: [{ id: idOrCode }, { code: idOrCode.toUpperCase() }] }, include: { ...bookingInclude, user: true } });
  if (!row) return null;
  const [drivers, settings] = await Promise.all([activeDrivers(), getSettings()]);
  return { booking: await adminBooking(row, settings.cancellationSlabs), drivers: drivers.map((d) => ({ id: d.id, name: d.user.name, phone: d.user.phone })) };
}

// ---------- Trips ----------

export async function adminTrips() {
  const [routes, vehicles, trips, drivers] = await Promise.all([
    db.route.findMany({ orderBy: [{ fromCity: "asc" }, { toCity: "asc" }] }),
    db.vehicle.findMany({ where: { active: true, allowSeatBooking: true } }),
    db.trip.findMany({
      where: { status: { in: ["SCHEDULED", "STARTED"] }, departAt: { gte: new Date(Date.now() - 12 * 3600_000) } },
      include: { route: true, vehicle: true, driver: { include: { user: true } }, _count: { select: { seats: true } } },
      orderBy: { departAt: "asc" },
      take: 200,
    }),
    activeDrivers(),
  ]);
  return {
    trips: trips.map(tripRow),
    // For the "Schedule seat trips" form.
    routes: routes.map((r) => ({ id: r.id, fromCity: r.fromCity, toCity: r.toCity, distanceKm: r.distanceKm, durationMins: r.durationMins })),
    vehicles: vehicles.map((v) => ({ id: v.id, name: v.name, regNumber: v.regNumber, seats: v.seats })),
    drivers: drivers.map((d) => ({ id: d.id, name: d.user.name, phone: d.user.phone })),
    today: istDay().todayStr,
  };
}

export async function adminTripDetail(id: string) {
  const trip = await db.trip.findUnique({
    where: { id },
    include: {
      route: true,
      vehicle: true,
      driver: { include: { user: true } },
      seats: true,
      bookings: { where: { status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] } }, include: { pickupStop: true, dropStop: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!trip) return null;
  const [drivers, stops] = await Promise.all([
    activeDrivers(),
    db.stop.findMany({ where: { active: true, city: { in: [trip.route.fromCity, trip.route.toCity] } }, orderBy: { sortOrder: "asc" } }),
  ]);
  const seatState = new Map(trip.seats.map((s) => [s.seatNo, s]));
  const seats = Array.from({ length: trip.vehicle.seats }, (_, i) => {
    const s = seatState.get(i + 1);
    return {
      seatNo: i + 1,
      state: !s ? "FREE" : s.bookingId ? "BOOKED" : "BLOCKED",
      blockReason: s && !s.bookingId ? s.blockReason : null,
      bookingId: s?.bookingId ?? null,
      female: s?.female ?? false,
    };
  });
  const confirmed = trip.bookings.filter((b) => b.status !== "PENDING");
  return {
    trip: { ...tripRow({ ...trip, _count: { seats: trip.seats.length } }), seatsPerRow: trip.vehicle.seatsPerRow, aisleAfter: trip.vehicle.aisleAfter, seatLayout: trip.vehicle.seatLayout },
    summary: {
      sold: confirmed.reduce((n, b) => n + b.passengers, 0),
      seats: trip.vehicle.seats,
      blocked: trip.seats.filter((s) => !s.bookingId).length,
      cashToCollect: confirmed.reduce((n, b) => n + cashDue(b), 0),
    },
    editable: trip.status === "SCHEDULED",
    seats,
    manifest: trip.bookings.map((b) => ({
      id: b.id,
      code: b.code,
      status: b.status,
      source: b.source,
      seatNos: b.seatNos ? b.seatNos.split(",").map(Number) : [],
      passengers: b.passengers,
      passengerName: b.passengerName,
      passengerPhone: b.passengerPhone,
      pickup: b.pickupStop?.name ?? trip.route.fromCity,
      drop: b.dropStop?.name ?? trip.route.toCity,
      paymentStatus: b.paymentStatus,
      totalAmount: b.totalAmount,
      cashDue: cashDue(b),
      boardedAt: b.boardedAt,
      noShow: b.noShow,
    })),
    pickupStops: stops.filter((s) => s.city === trip.route.fromCity).map(publicStop),
    dropStops: stops.filter((s) => s.city === trip.route.toCity).map(publicStop),
    drivers: drivers.map((d) => ({ id: d.id, name: d.user.name, phone: d.user.phone })),
    blockReasons: BLOCK_REASONS,
  };
}

// ---------- Vehicles & drivers ----------

export async function adminVehicles() {
  return { vehicles: (await db.vehicle.findMany({ orderBy: { createdAt: "asc" } })).map(vehicleRow), vehicleTypes: VEHICLE_TYPES };
}

export async function adminVehicle(id: string) {
  const v = await db.vehicle.findUnique({ where: { id } });
  return v ? { vehicle: vehicleRow(v), vehicleTypes: VEHICLE_TYPES } : null;
}

export async function adminDrivers() {
  const drivers = await db.driver.findMany({
    include: { user: true, _count: { select: { trips: { where: { status: "COMPLETED" } }, bookings: { where: { status: "COMPLETED" } } } } },
    orderBy: { createdAt: "asc" },
  });
  const cash = await db.booking.groupBy({
    by: ["cashCollectedBy"],
    where: { cashCollectedBy: { not: null }, cashHandedOverAt: null, cashCollected: { gt: 0 } },
    _sum: { cashCollected: true },
    _count: true,
  });
  const cashHeld = new Map(cash.map((c) => [c.cashCollectedBy!, { amount: c._sum.cashCollected ?? 0, count: c._count }]));
  const rated = await db.booking.findMany({ where: { rating: { not: null } }, select: { rating: true, driverId: true, trip: { select: { driverId: true } } } });
  const ratings = new Map<string, { sum: number; n: number }>();
  for (const r of rated) {
    const id = r.trip?.driverId ?? r.driverId;
    if (!id) continue;
    const x = ratings.get(id) ?? { sum: 0, n: 0 };
    x.sum += r.rating!;
    x.n++;
    ratings.set(id, x);
  }
  const row = (d: (typeof drivers)[number]) => {
    const r = ratings.get(d.id);
    return {
      ...driverRow(d),
      tripsDone: d._count.trips + d._count.bookings,
      cashHeld: cashHeld.get(d.id) ?? { amount: 0, count: 0 },
      rating: r ? { average: Math.round((r.sum / r.n) * 10) / 10, count: r.n } : null,
    };
  };
  return {
    // Send this back as `upTo` with markCashReceived: only the cash shown here is marked received.
    loadedAt: new Date().toISOString(),
    pending: drivers.filter((d) => d.status === "PENDING").sort((a, b) => (a.appliedAt?.getTime() ?? 0) - (b.appliedAt?.getTime() ?? 0)).map(row),
    drivers: drivers.filter((d) => d.status !== "PENDING").map(row),
  };
}

export async function adminDriver(id: string) {
  const d = await db.driver.findUnique({ where: { id }, include: { user: true } });
  return d ? { driver: driverRow(d) } : null;
}

// ---------- Routes, stops, fleet ----------

export async function adminRoutes() {
  const routes = await db.route.findMany({ orderBy: [{ fromCity: "asc" }, { toCity: "asc" }], include: { _count: { select: { trips: true } } } });
  return {
    routes: routes.map((r) => ({
      id: r.id,
      fromCity: r.fromCity,
      toCity: r.toCity,
      distanceKm: r.distanceKm,
      durationMins: r.durationMins,
      tollAmount: r.tollAmount,
      parkingAmount: r.parkingAmount,
      trips: r._count.trips,
      canDelete: r._count.trips === 0,
    })),
  };
}

const citiesOf = (routes: { fromCity: string; toCity: string }[]) => [...new Set(routes.flatMap((r) => [r.fromCity, r.toCity]))].sort();

export async function adminStops() {
  const [stops, routes] = await Promise.all([
    db.stop.findMany({ orderBy: [{ city: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    db.route.findMany({ select: { fromCity: true, toCity: true } }),
  ]);
  return { stops: stops.map((s) => ({ ...publicStop(s), sortOrder: s.sortOrder, active: s.active })), cities: citiesOf(routes) };
}

export async function adminFleet() {
  const now = new Date();
  const { dayStart, dayEnd } = istDay(now);
  const until = new Date(now.getTime() + 14 * 24 * 3600_000);
  const [routes, vehicles, trips, off, locations, rentalsNow] = await Promise.all([
    db.route.findMany({ orderBy: [{ fromCity: "asc" }, { toCity: "asc" }] }),
    db.vehicle.findMany({ where: { active: true }, orderBy: [{ allowSeatBooking: "desc" }, { seats: "desc" }, { name: "asc" }] }),
    db.trip.findMany({
      where: { status: { in: ["SCHEDULED", "STARTED"] }, departAt: { lt: until }, OR: [{ departAt: { gte: dayStart } }, { status: "STARTED" }] },
      include: { driver: { include: { user: true } }, _count: { select: { seats: true } } },
      orderBy: { departAt: "asc" },
    }),
    offPairs(),
    db.vehicleLocation.findMany({ where: { updatedAt: { gte: new Date(now.getTime() - LIVE_MIN * 60_000) } } }),
    db.booking.findMany({ where: { kind: "RENTAL", startedAt: { not: null }, completedAt: null, status: "CONFIRMED" }, include: { driver: { include: { user: true } } } }),
  ]);
  const live = new Map(locations.map((l) => [l.vehicleId, l]));
  const onRoad = vehicles
    .filter((v) => live.has(v.id) || trips.some((t) => t.vehicleId === v.id && t.status === "STARTED") || rentalsNow.some((b) => b.vehicleId === v.id))
    .map((v) => {
      const t = trips.find((x) => x.vehicleId === v.id && x.status === "STARTED");
      const r = t && routes.find((x) => x.id === t.routeId);
      const rental = rentalsNow.find((b) => b.vehicleId === v.id);
      const loc = live.get(v.id);
      const driver = t?.driver ?? rental?.driver ?? null;
      return {
        vehicle: { id: v.id, name: v.name, regNumber: v.regNumber },
        what: r ? `${r.fromCity} → ${r.toCity}` : rental ? `Full cab ${rental.code}` : "Sharing location",
        since: t ? (t.startedAt ?? t.departAt) : (rental?.startedAt ?? null),
        driverName: driver?.user.name ?? null,
        location: loc ? { lat: loc.lat, lng: loc.lng, speed: loc.speed, updatedAt: loc.updatedAt, mapUrl: `https://maps.google.com/?q=${loc.lat},${loc.lng}` } : null,
      };
    });
  const busyIds = new Set(trips.map((t) => t.routeId));
  const ordered = [...routes.filter((r) => busyIds.has(r.id)), ...routes.filter((r) => !busyIds.has(r.id))];
  return {
    onRoad,
    vehicles: vehicles.map((v) => ({ id: v.id, name: v.name, regNumber: v.regNumber, seats: v.seats, allowSeatBooking: v.allowSeatBooking, allowRental: v.allowRental })),
    routes: ordered.map((r) => ({
      id: r.id,
      fromCity: r.fromCity,
      toCity: r.toCity,
      distanceKm: r.distanceKm,
      durationMins: r.durationMins,
      vehicles: vehicles.map((v) => {
        const list = trips.filter((t) => t.routeId === r.id && t.vehicleId === v.id);
        return {
          vehicleId: v.id,
          on: !isOffIn(off, r.id, v.id),
          upcomingTrips: list.length,
          today: list
            .filter((t) => t.departAt < dayEnd)
            .map((t) => ({ id: t.id, departAt: t.departAt, status: t.status, seatsTaken: t._count.seats, driverName: t.driver?.user.name ?? null })),
          next: list[0] ? { id: list[0].id, departAt: list[0].departAt } : null,
        };
      }),
    })),
  };
}

// ---------- Settings, feedback, messages, reports ----------

export async function adminSettings() {
  return {
    settings: await getSettings(),
    status: { onlinePayments: !isDemoPayments(), mobileOtp: otpAvailable("PHONE") && process.env.OTP_DEV_MODE !== "true" },
  };
}

export async function adminFeedback() {
  const since = new Date(Date.now() - 90 * 24 * 3600_000);
  const [feedback, rated] = await Promise.all([
    db.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    db.booking.findMany({
      where: { rating: { not: null }, ratedAt: { gte: since } },
      include: { trip: { include: { route: true, driver: { include: { user: true } } } }, driver: { include: { user: true } } },
      orderBy: { ratedAt: "desc" },
      take: 200,
    }),
  ]);
  const all = [...feedback.map((f) => f.rating), ...rated.map((b) => b.rating!)];
  return {
    average: all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10 : null,
    total: all.length,
    open: feedback.filter((f) => !f.handled).length,
    feedback: feedback.map((f) => ({
      id: f.id,
      name: f.name,
      phone: f.phone,
      rating: f.rating,
      comment: f.comment,
      bookingCode: f.bookingCode,
      source: f.source,
      handled: f.handled,
      createdAt: f.createdAt,
    })),
    ratings: rated.map((b) => ({
      bookingId: b.id,
      code: b.code,
      rating: b.rating!,
      comment: b.ratingComment ?? "",
      ratedAt: b.ratedAt,
      passengerName: b.passengerName,
      title: b.trip ? `${b.trip.route.fromCity} → ${b.trip.route.toCity}` : `Full cab ${b.pickupCity ?? ""}${b.dropCity ? ` → ${b.dropCity}` : ""}`,
      driverName: (b.trip?.driver ?? b.driver)?.user.name ?? null,
    })),
  };
}

export async function adminMessages() {
  const messages = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return {
    connected: !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    templates: WHATSAPP_TEMPLATES.map((t) => ({ ...t, name: process.env[`WHATSAPP_TEMPLATE_${t.event}`] || null })),
    messages: messages.map((m) => ({ id: m.id, channel: m.channel, to: m.to, event: m.event, body: m.body, status: m.status, error: m.error, createdAt: m.createdAt })),
  };
}

export async function adminReport(p: { type?: string; from?: string; to?: string }) {
  const type = p.type && REPORTS[p.type] ? p.type : "daily";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const from = p.from || `${today.slice(0, 7)}-01`;
  const to = p.to || today;
  const report = await buildReport(type, from, to);
  const moneyCols = report.columns.map((c) => c.includes("(₹)"));
  const totals =
    report.rows.length > 1 && type !== "occupancy"
      ? report.columns.map((c, i) =>
          i === 0 ? "Total" : moneyCols[i] || /Bookings|seats|Full cabs|passengers|Cancelled|Invoices|Sold|trips|km/i.test(c) ? report.rows.reduce((n, r) => n + (Number(r[i]) || 0), 0) : "",
        )
      : null;
  return { types: REPORTS, type, from, to, ...report, moneyColumns: moneyCols, totals, csvUrl: `/admin/reports/export?${new URLSearchParams({ type, from, to })}` };
}

// ---------- Form options ----------

export async function adminOptions() {
  const [routes, vehicles, drivers, stops] = await Promise.all([
    db.route.findMany({ orderBy: [{ fromCity: "asc" }, { toCity: "asc" }] }),
    db.vehicle.findMany({ where: { active: true }, orderBy: { seats: "asc" } }),
    activeDrivers(),
    db.stop.findMany({ where: { active: true }, orderBy: [{ city: "asc" }, { sortOrder: "asc" }] }),
  ]);
  return {
    routes: routes.map((r) => ({ id: r.id, fromCity: r.fromCity, toCity: r.toCity, distanceKm: r.distanceKm, durationMins: r.durationMins })),
    vehicles: vehicles.map((v) => ({ id: v.id, name: v.name, regNumber: v.regNumber, seats: v.seats, allowSeatBooking: v.allowSeatBooking, allowRental: v.allowRental })),
    drivers: drivers.map((d) => ({ id: d.id, name: d.user.name, phone: d.user.phone })),
    cities: citiesOf(routes),
    stops: stops.map(publicStop),
    blockReasons: BLOCK_REASONS,
    rentalTypes: RENTAL_TYPES,
    vehicleTypes: VEHICLE_TYPES,
    bookingStatuses: BOOKING_STATUSES,
  };
}
