// Runs on every start of the live server (see "start:prod" in package.json). Safe to run repeatedly.
// 1. First run only: loads the business data (fleet, routes, pickup points, trips) and removes demo accounts.
// 2. Every run: makes sure the admin account from ADMIN_EMAIL / ADMIN_PHONE / ADMIN_PASSWORD exists.
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DEMO_PHONES = ["9999999999", "9000000001", "9000000002"];

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const phone = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !phone || !/^[6-9]\d{9}$/.test(phone) || password.length < 10) {
    throw new Error("Set ADMIN_EMAIL, ADMIN_PHONE (10 digits) and ADMIN_PASSWORD (at least 10 characters) in the server environment.");
  }

  const initialised = await db.setting.findUnique({ where: { key: "prodInitialised" } });
  if (!initialised) {
    if ((await db.vehicle.count()) === 0) {
      console.log("First start: loading business data…");
      execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
      execSync("npx tsx prisma/rebrand.ts", { stdio: "inherit" });
    }
    // Remove the demo customer, demo drivers and the sample admin (only if they have no real bookings).
    const demoDrivers = await db.driver.findMany({ where: { user: { phone: { in: DEMO_PHONES } } } });
    for (const d of demoDrivers) {
      await db.trip.updateMany({ where: { driverId: d.id }, data: { driverId: null } });
      await db.booking.updateMany({ where: { driverId: d.id }, data: { driverId: null } });
      await db.driver.delete({ where: { id: d.id } });
    }
    for (const u of await db.user.findMany({ where: { OR: [{ phone: { in: DEMO_PHONES } }, { email: "admin@roadyatra.in" }] }, include: { _count: { select: { bookings: true } } } })) {
      if (u._count.bookings === 0 && u.email !== email) await db.user.delete({ where: { id: u.id } });
    }
    await db.setting.create({ data: { key: "prodInitialised", value: JSON.stringify(new Date().toISOString()) } });
  }

  // Real seat layouts for the fleet, set once (an admin can change them in Vehicles afterwards):
  // Ertiga = 1 front + 3 middle + 2 back, Dzire/hatchback = 1 front + 3 back.
  const layouts: [string[], number, string][] = [
    [["ERTIGA"], 6, "1,3,2"],
    [["SEDAN", "HATCHBACK"], 4, "1,3"],
  ];
  for (const [types, seats, seatLayout] of layouts) {
    const r = await db.vehicle.updateMany({ where: { type: { in: types }, seats, seatLayout: "" }, data: { seatLayout } });
    if (r.count) console.log(`Seat layout ${seatLayout} set on ${r.count} vehicle(s)`);
  }

  // Driver cash recorded before cashCollected existed: it was always the whole fare, taken when it was marked paid.
  const old = await db.booking.findMany({ where: { cashCollectedBy: { not: null }, cashCollectedAt: null }, select: { id: true, totalAmount: true, paidAt: true } });
  for (const b of old) await db.booking.update({ where: { id: b.id }, data: { cashCollected: b.totalAmount, cashCollectedAt: b.paidAt ?? new Date() } });
  if (old.length) console.log(`Backfilled driver cash on ${old.length} booking(s)`);

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await db.user.findFirst({ where: { OR: [{ email }, { phone }] } });
  if (existing) await db.user.update({ where: { id: existing.id }, data: { email, phone, role: "ADMIN", passwordHash } });
  else await db.user.create({ data: { name: "Admin", email, phone, role: "ADMIN", passwordHash } });
  console.log(`Admin account ready: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
