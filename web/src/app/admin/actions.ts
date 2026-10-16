"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { assignInvoiceNo, cancelBooking, createRentalBooking, createSeatBooking, findOrCreateCustomer, notifyDriverAssigned, type RentalType } from "@/lib/booking";
import { notifyDriverDuty } from "@/lib/driver";
import { HttpError } from "@/lib/http";
import { notify } from "@/lib/notify";
import { saveSetting, type CancellationSlab } from "@/lib/settings";
import { BLOCK_REASONS } from "@/lib/format";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new Error("Not authorised");
  return user;
}

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(f.get(k) ?? 0);
const bool = (f: FormData, k: string) => f.get(k) === "on";
const date = (f: FormData, k: string) => (str(f, k) ? new Date(`${str(f, k)}T00:00:00+05:30`) : null);

/** Runs a booking-engine call and turns its user-facing errors into a redirect with the message. */
async function attempt<T>(back: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) fail(back, e.message);
    throw e;
  }
}

// ---------- Vehicles ----------

export async function saveVehicle(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const data = {
    name: str(formData, "name"),
    type: str(formData, "type"),
    regNumber: str(formData, "regNumber").toUpperCase().replace(/\s+/g, ""),
    seats: num(formData, "seats"),
    seatsPerRow: num(formData, "seatsPerRow"),
    aisleAfter: num(formData, "aisleAfter"),
    amenities: str(formData, "amenities"),
    imageUrl: str(formData, "imageUrl") || null,
    allowSeatBooking: bool(formData, "allowSeatBooking"),
    allowRental: bool(formData, "allowRental"),
    ratePerKm: num(formData, "ratePerKm"),
    minKmPerDay: num(formData, "minKmPerDay"),
    driverAllowance: num(formData, "driverAllowance"),
    localPackage: num(formData, "localPackage"),
    airportFare: num(formData, "airportFare"),
    tollFactor: num(formData, "tollFactor") || 1,
    insuranceExpiry: date(formData, "insuranceExpiry"),
    permitExpiry: date(formData, "permitExpiry"),
    fitnessExpiry: date(formData, "fitnessExpiry"),
    pucExpiry: date(formData, "pucExpiry"),
    active: bool(formData, "active"),
  };
  const back = id ? `/admin/vehicles/${id}` : "/admin/vehicles/new";
  if (!data.name || !data.regNumber || data.seats < 1 || data.seatsPerRow < 1) fail(back, "Name, registration number and seats are required.");
  const dup = await db.vehicle.findFirst({ where: { regNumber: data.regNumber, NOT: id ? { id } : undefined } });
  if (dup) fail(back, `Another vehicle already has registration ${data.regNumber}.`);
  if (id) await db.vehicle.update({ where: { id }, data });
  else await db.vehicle.create({ data });
  revalidatePath("/admin/vehicles");
  redirect("/admin/vehicles");
}

// ---------- Drivers ----------

export async function saveDriver(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const back = id ? `/admin/drivers/${id}` : "/admin/drivers/new";
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const password = str(formData, "password");
  const data = {
    licenceNo: str(formData, "licenceNo").toUpperCase(),
    licenceExpiry: date(formData, "licenceExpiry"),
    photoUrl: str(formData, "photoUrl") || null,
    notes: str(formData, "notes"),
    active: bool(formData, "active"),
  };
  if (name.length < 2 || !/^[6-9]\d{9}$/.test(phone) || !data.licenceNo) fail(back, "Name, a valid 10-digit mobile number and licence number are required.");
  if (password && password.length < 6) fail(back, "Password must be at least 6 characters.");

  const existing = id ? await db.driver.findUniqueOrThrow({ where: { id } }) : null;
  const phoneOwner = await db.user.findUnique({ where: { phone } });
  if (phoneOwner && phoneOwner.id !== existing?.userId) {
    if (phoneOwner.role === "ADMIN" || (await db.driver.findUnique({ where: { userId: phoneOwner.id } }))) fail(back, "This mobile number already belongs to another staff account.");
  }
  const passwordHash = password ? await hashPassword(password) : undefined;

  if (existing) {
    await db.user.update({ where: { id: existing.userId }, data: { name, phone, ...(passwordHash ? { passwordHash } : {}) } });
    await db.driver.update({ where: { id }, data });
  } else {
    // A customer account with this number becomes the driver's account.
    const u = phoneOwner
      ? await db.user.update({ where: { id: phoneOwner.id }, data: { name, role: "DRIVER", ...(passwordHash ? { passwordHash } : {}) } })
      : await db.user.create({ data: { name, phone, role: "DRIVER", passwordHash } });
    await db.driver.create({ data: { ...data, userId: u.id } });
  }
  revalidatePath("/admin/drivers");
  redirect("/admin/drivers");
}

// ---------- Routes & stops ----------

export async function addRoute(formData: FormData) {
  await requireAdmin();
  const fromCity = str(formData, "fromCity");
  const toCity = str(formData, "toCity");
  const distanceKm = num(formData, "distanceKm");
  const durationMins = Math.round(num(formData, "durationHours") * 60);
  const tollAmount = num(formData, "tollAmount");
  const parkingAmount = num(formData, "parkingAmount");
  if (!fromCity || !toCity || fromCity === toCity || distanceKm <= 0 || durationMins <= 0) fail("/admin/routes", "Fill in all route fields (cities must be different).");
  const pairs = bool(formData, "bothWays") ? [[fromCity, toCity], [toCity, fromCity]] : [[fromCity, toCity]];
  for (const [a, b] of pairs) {
    const data = { distanceKm, durationMins, tollAmount, parkingAmount };
    await db.route.upsert({ where: { fromCity_toCity: { fromCity: a, toCity: b } }, update: data, create: { fromCity: a, toCity: b, ...data } });
  }
  revalidatePath("/admin/routes");
}

export async function deleteRoute(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  if ((await db.trip.count({ where: { routeId: id } })) > 0) fail("/admin/routes", "This route has trips on it, so it cannot be deleted.");
  await db.route.delete({ where: { id } });
  revalidatePath("/admin/routes");
}

export async function saveStop(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const lat = str(formData, "lat") ? num(formData, "lat") : null;
  const lng = str(formData, "lng") ? num(formData, "lng") : null;
  const data = { city: str(formData, "city"), name: str(formData, "name"), address: str(formData, "address"), lat, lng, sortOrder: num(formData, "sortOrder"), active: id ? bool(formData, "active") : true };
  if (!data.city || !data.name) fail("/admin/stops", "City and point name are required.");
  try {
    if (id) await db.stop.update({ where: { id }, data });
    else await db.stop.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") fail("/admin/stops", `${data.city} already has a point called "${data.name}".`);
    throw e;
  }
  revalidatePath("/admin/stops");
}

// ---------- Trips ----------

/** Creates one trip per day for `days` days, skipping days where the vehicle is already busy. */
export async function scheduleTrips(formData: FormData) {
  await requireAdmin();
  const route = await db.route.findUniqueOrThrow({ where: { id: str(formData, "routeId") } });
  const vehicleId = str(formData, "vehicleId");
  const driverId = str(formData, "driverId") || null;
  const startDate = str(formData, "startDate"); // YYYY-MM-DD
  const time = str(formData, "time"); // HH:mm
  const days = Math.min(Math.max(num(formData, "days"), 1), 90);
  const fare = num(formData, "fare");
  const boardingPoint = str(formData, "boardingPoint");
  if (!vehicleId || !startDate || !time || fare <= 0) fail("/admin/trips", "Fill in all trip fields.");

  let created = 0;
  let skipped = 0;
  const first = new Date(`${startDate}T${time}:00+05:30`);
  for (let i = 0; i < days; i++) {
    const departAt = new Date(first.getTime() + i * 24 * 3600_000);
    const arriveAt = new Date(departAt.getTime() + route.durationMins * 60_000);
    const overlap = { departAt: { lt: arriveAt }, arriveAt: { gt: departAt }, status: { in: ["SCHEDULED", "STARTED"] } };
    const busy =
      (await db.trip.findFirst({ where: { vehicleId, ...overlap } })) ||
      (driverId && (await db.trip.findFirst({ where: { driverId, ...overlap } }))) ||
      (await db.booking.findFirst({
        where: { vehicleId, kind: "RENTAL", status: { in: ["PENDING", "CONFIRMED"] }, startAt: { lt: arriveAt }, endAt: { gt: departAt } },
      }));
    if (busy || departAt < new Date()) {
      skipped++;
      continue;
    }
    await db.trip.create({ data: { routeId: route.id, vehicleId, driverId, departAt, arriveAt, fare, boardingPoint } });
    created++;
  }
  revalidatePath("/admin/trips");
  redirect(`/admin/trips?created=${created}&skipped=${skipped}`);
}

export async function assignTripDriver(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const driverId = str(formData, "driverId") || null;
  const trip = await db.trip.findUniqueOrThrow({ where: { id } });
  if (driverId) {
    const clash = await db.trip.findFirst({
      where: { driverId, id: { not: id }, status: { in: ["SCHEDULED", "STARTED"] }, departAt: { lt: trip.arriveAt }, arriveAt: { gt: trip.departAt } },
    });
    if (clash) fail(`/admin/trips/${id}`, "This driver already has another trip at that time.");
  }
  const changed = driverId !== trip.driverId;
  // A new driver has to accept afresh; clearing the driver keeps the last rejection note for the office.
  await db.trip.update({ where: { id }, data: { driverId, ...(changed && driverId ? { driverResponse: null, driverRespondedAt: null, driverNote: null } : {}) } });
  if (driverId && changed) {
    const bookings = await db.booking.findMany({ where: { tripId: id, status: "CONFIRMED" }, select: { id: true } });
    await notifyDriverAssigned(bookings.map((b) => b.id));
    await notifyDriverDuty("TRIP", id);
  }
  revalidatePath(`/admin/trips/${id}`);
  revalidatePath("/admin/trips");
}

export async function cancelTrip(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const bookings = await db.booking.findMany({ where: { tripId: id, status: { in: ["PENDING", "CONFIRMED"] } } });
  // The operator cancelled, so customers get a full refund.
  for (const b of bookings) await cancelBooking(b.id, { by: "ADMIN", refundAmount: b.totalAmount, note: "Trip cancelled by operator" });
  await db.bookedSeat.deleteMany({ where: { tripId: id } });
  await db.trip.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/admin/trips");
}

export async function blockSeats(formData: FormData) {
  await requireAdmin();
  const tripId = str(formData, "tripId");
  const reason = str(formData, "reason");
  const seatNos = formData.getAll("seatNos").map(Number).filter((n) => n > 0);
  const back = `/admin/trips/${tripId}`;
  if (!seatNos.length || !BLOCK_REASONS.includes(reason)) fail(back, "Choose the seats and a reason.");
  try {
    await db.bookedSeat.createMany({ data: seatNos.map((seatNo) => ({ tripId, seatNo, blockReason: reason })) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") fail(back, "One of those seats is already booked or blocked.");
    throw e;
  }
  revalidatePath(back);
}

export async function unblockSeat(formData: FormData) {
  await requireAdmin();
  const tripId = str(formData, "tripId");
  await db.bookedSeat.deleteMany({ where: { tripId, seatNo: num(formData, "seatNo"), bookingId: null } });
  revalidatePath(`/admin/trips/${tripId}`);
}

/** Phone / walk-in seat booking entered by the office. Confirmed immediately. */
export async function offlineSeatBooking(formData: FormData) {
  await requireAdmin();
  const tripId = str(formData, "tripId");
  const back = `/admin/trips/${tripId}`;
  const name = str(formData, "passengerName");
  const phone = str(formData, "passengerPhone");
  if (name.length < 2 || !/^[6-9]\d{9}$/.test(phone)) fail(back, "Enter the passenger name and a valid 10-digit mobile number.");
  const customer = await findOrCreateCustomer(phone, name);
  const b = await attempt(back, () =>
    createSeatBooking({
      userId: customer.id,
      tripId,
      seatNos: formData.getAll("seatNos").map(Number),
      passengerName: name,
      passengerPhone: phone,
      pickupStopId: str(formData, "pickupStopId") || undefined,
      dropStopId: str(formData, "dropStopId") || undefined,
      source: "OFFLINE",
      payment: "CASH",
      markPaid: bool(formData, "paid"),
    }),
  );
  revalidatePath(back);
  redirect(`${back}?created=${b.code}`);
}

/** Phone / walk-in full-cab booking entered by the office. Confirmed immediately. */
export async function offlineRentalBooking(formData: FormData) {
  await requireAdmin();
  const back = "/admin/bookings/new";
  const name = str(formData, "passengerName");
  const phone = str(formData, "passengerPhone");
  if (name.length < 2 || !/^[6-9]\d{9}$/.test(phone)) fail(back, "Enter the customer name and a valid 10-digit mobile number.");
  const start = str(formData, "startAt");
  const ret = str(formData, "returnAt");
  if (!start) fail(back, "Choose the pickup date and time.");
  const customer = await findOrCreateCustomer(phone, name);
  const b = await attempt(back, () =>
    createRentalBooking({
      userId: customer.id,
      vehicleId: str(formData, "vehicleId"),
      rentalType: str(formData, "rentalType") as RentalType,
      pickupCity: str(formData, "pickupCity"),
      dropCity: str(formData, "dropCity") || undefined,
      startAt: new Date(`${start}:00+05:30`),
      returnAt: ret ? new Date(`${ret}:00+05:30`) : undefined,
      pickupAddress: str(formData, "pickupAddress"),
      dropAddress: str(formData, "dropAddress"),
      passengers: Math.max(1, num(formData, "passengers")),
      passengerName: name,
      passengerPhone: phone,
      source: "OFFLINE",
      payment: "CASH",
      markPaid: bool(formData, "paid"),
    }),
  );
  redirect(`/admin/bookings?q=${b.code}`);
}

// ---------- Bookings ----------

export async function updateBooking(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const action = str(formData, "action");
  const note = str(formData, "note") || undefined;
  const back = str(formData, "back") || "/admin/bookings";
  const b = await db.booking.findUniqueOrThrow({ where: { id } });

  if (action === "cancel") {
    const refund = str(formData, "refundAmount");
    await cancelBooking(id, { by: "ADMIN", refundAmount: refund === "" ? undefined : Number(refund), note: note ?? "Cancelled by operator" });
  } else if (action === "complete") {
    await db.booking.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
  } else if (action === "cash") {
    await db.booking.update({ where: { id }, data: { paymentStatus: "PAID", paymentMode: b.paymentMode ?? "CASH", paidAt: new Date() } });
    await assignInvoiceNo(id);
  } else if (action === "refunded") {
    await db.booking.update({ where: { id }, data: { paymentStatus: "REFUNDED" } });
    await notify(b.passengerPhone, "REFUND_DONE", [b.code, String(b.refundAmount ?? 0)], `Refund of Rs ${b.refundAmount ?? 0} for booking ${b.code} has been processed.`);
  } else if (action === "assign") {
    const driverId = str(formData, "driverId") || null;
    if (driverId && b.startAt && b.endAt) {
      const clash =
        (await db.booking.findFirst({
          where: { driverId, id: { not: id }, kind: "RENTAL", status: "CONFIRMED", startAt: { lt: b.endAt }, endAt: { gt: b.startAt } },
        })) ||
        (await db.trip.findFirst({ where: { driverId, status: { in: ["SCHEDULED", "STARTED"] }, departAt: { lt: b.endAt }, arriveAt: { gt: b.startAt } } }));
      if (clash) fail(back, "This driver is already on duty at that time.");
    }
    const changed = driverId !== b.driverId;
    await db.booking.update({ where: { id }, data: { driverId, ...(changed && driverId ? { driverResponse: null, driverRespondedAt: null, driverNote: null } : {}) } });
    if (driverId && changed) {
      await notifyDriverAssigned([id]);
      await notifyDriverDuty("RENTAL", id);
    }
  } else if (action === "note") {
    await db.booking.update({ where: { id }, data: { adminNote: note ?? null } });
  }
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  if (back !== "/admin/bookings") revalidatePath(back);
}

// ---------- Settings ----------

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  await saveSetting("business", {
    legalName: str(formData, "legalName"),
    gstin: str(formData, "gstin").toUpperCase(),
    address: str(formData, "address"),
    stateName: str(formData, "stateName"),
    stateCode: str(formData, "stateCode"),
    sacCode: str(formData, "sacCode"),
    email: str(formData, "email"),
  });
  const slabs: CancellationSlab[] = [];
  for (let i = 0; i < 5; i++) {
    const h = str(formData, `slabHours${i}`);
    const p = str(formData, `slabRefund${i}`);
    if (h === "" || p === "") continue;
    slabs.push({ minHoursBefore: Math.max(0, Number(h)), refundPercent: Math.min(100, Math.max(0, Number(p))) });
  }
  if (!slabs.some((s) => s.minHoursBefore === 0)) slabs.push({ minHoursBefore: 0, refundPercent: 0 });
  await saveSetting("cancellationSlabs", slabs.sort((a, b) => b.minHoursBefore - a.minHoursBefore));
  await saveSetting("allowCash", bool(formData, "allowCash"));
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}

// ---------- Driver cash & SOS ----------

/** The driver handed all the cash they collected to the office. */
export async function markCashReceived(formData: FormData) {
  await requireAdmin();
  const driverId = str(formData, "driverId");
  await db.booking.updateMany({ where: { cashCollectedBy: driverId, cashHandedOverAt: null }, data: { cashHandedOverAt: new Date() } });
  revalidatePath("/admin/drivers");
  revalidatePath("/admin");
}

export async function resolveSos(formData: FormData) {
  await requireAdmin();
  await db.sosAlert.update({ where: { id: str(formData, "id") }, data: { resolvedAt: new Date() } });
  revalidatePath("/admin");
}

// ---------- Driver applications ----------

export async function reviewDriverApplication(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const decision = str(formData, "decision");
  const back = `/admin/drivers/${id}`;
  const d = await db.driver.findUniqueOrThrow({ where: { id }, include: { user: true } });
  if (d.status !== "PENDING") fail(back, "This application has already been reviewed.");

  if (decision === "approve") {
    if (d.user.role === "ADMIN") fail(back, "An admin account cannot be made a driver.");
    await db.$transaction([
      db.driver.update({ where: { id }, data: { status: "APPROVED", active: true, reviewedAt: new Date(), rejectReason: null } }),
      db.user.update({ where: { id: d.userId }, data: { role: "DRIVER" } }),
    ]);
    await notify(d.user.phone, "DRIVER_APPROVED", [d.user.name], `Congratulations ${d.user.name}, your JSS Travels driver application is approved. Log in to the JSS Travels Driver app to see your duties.`);
  } else if (decision === "reject") {
    const reason = str(formData, "reason");
    if (reason.length < 3) fail(back, "Please give a reason so the driver knows what to fix.");
    await db.driver.update({ where: { id }, data: { status: "REJECTED", active: false, reviewedAt: new Date(), rejectReason: reason } });
    await notify(d.user.phone, "DRIVER_REJECTED", [d.user.name, reason], `Your JSS Travels driver application was not approved: ${reason}. You can correct it and apply again in the driver app.`);
  }
  revalidatePath("/admin/drivers");
  revalidatePath(back);
  redirect(`/admin/drivers/${id}?reviewed=${decision}`);
}
