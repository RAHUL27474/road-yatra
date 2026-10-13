// Base sample data (logins, sample vehicles, routes, stops, trips). prisma/rebrand.ts then applies
// Jai Shree Shyam Tour & Travels' real fleet, routes and business details (npm run setup runs both).
// Edit or delete it from the admin panel. Run with: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function user(data: { name: string; phone: string; email?: string; role?: string; password?: string }) {
  return db.user.upsert({
    where: { phone: data.phone },
    update: {},
    create: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      role: data.role ?? "CUSTOMER",
      passwordHash: data.password ? await bcrypt.hash(data.password, 10) : null,
    },
  });
}

async function main() {
  await user({ name: "Admin", phone: "9000000000", email: "admin@roadyatra.in", role: "ADMIN", password: "admin123" });
  await user({ name: "Demo Customer", phone: "9999999999", email: "demo@roadyatra.in", password: "demo123" });

  // Drivers log in to the driver app with their mobile number (OTP) or this password.
  const drivers = [
    { name: "Ramesh Singh", phone: "9000000001", licenceNo: "UK0620150012345" },
    { name: "Suresh Kumar", phone: "9000000002", licenceNo: "UK0620180067890" },
  ];
  const driverIds: string[] = [];
  for (const d of drivers) {
    const u = await user({ name: d.name, phone: d.phone, role: "DRIVER", password: "driver123" });
    const driver = await db.driver.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, licenceNo: d.licenceNo, licenceExpiry: new Date("2030-03-31") },
    });
    driverIds.push(driver.id);
  }

  // Placeholder vehicles. Replace them with your real vehicles in Admin -> Vehicles.
  const inAYear = new Date(Date.now() + 365 * 24 * 3600_000);
  const soon = new Date(Date.now() + 20 * 24 * 3600_000); // shows up in the "documents expiring" alert
  const vehicles = [
    {
      name: "Maruti Ertiga",
      type: "ERTIGA",
      regNumber: "UK06TA1001",
      seats: 6,
      seatsPerRow: 3,
      aisleAfter: 0,
      amenities: "AC,Music,Charging Point",
      allowSeatBooking: true,
      allowRental: true,
      ratePerKm: 13,
      driverAllowance: 400,
      localPackage: 2200,
      airportFare: 1800,
      tollFactor: 1,
      insuranceExpiry: inAYear,
      permitExpiry: inAYear,
      fitnessExpiry: soon,
      pucExpiry: inAYear,
    },
    {
      name: "Toyota Innova Crysta",
      type: "INNOVA_CRYSTA",
      regNumber: "UK06TA1002",
      seats: 7,
      seatsPerRow: 3,
      aisleAfter: 0,
      amenities: "AC,Music,Charging Point,Extra Luggage",
      allowSeatBooking: false,
      allowRental: true,
      ratePerKm: 18,
      driverAllowance: 500,
      localPackage: 3200,
      airportFare: 2500,
      tollFactor: 1,
      insuranceExpiry: inAYear,
      permitExpiry: inAYear,
      fitnessExpiry: inAYear,
      pucExpiry: inAYear,
    },
    {
      name: "Maruti Swift Dzire",
      type: "SEDAN",
      regNumber: "UK06TA1003",
      seats: 4,
      seatsPerRow: 2,
      aisleAfter: 0,
      amenities: "AC,Music",
      allowSeatBooking: false,
      allowRental: true,
      ratePerKm: 11,
      driverAllowance: 350,
      localPackage: 1800,
      airportFare: 1400,
      tollFactor: 1,
      insuranceExpiry: inAYear,
      permitExpiry: inAYear,
      fitnessExpiry: inAYear,
      pucExpiry: inAYear,
    },
  ];
  for (const v of vehicles) await db.vehicle.upsert({ where: { regNumber: v.regNumber }, update: {}, create: v });

  // [from, to, km, minutes, toll (car, one way), parking]
  const routes: [string, string, number, number, number, number][] = [
    ["Khatima", "Delhi", 290, 420, 450, 100],
    ["Khatima", "Rudrapur", 75, 120, 0, 0],
    ["Khatima", "Pantnagar", 85, 135, 0, 0],
    ["Khatima", "Haldwani", 95, 150, 0, 0],
    ["Khatima", "Bareilly", 110, 180, 120, 0],
    ["Khatima", "Moradabad", 175, 270, 250, 0],
    ["Khatima", "Dehradun", 340, 540, 300, 0],
  ];
  for (const [fromCity, toCity, distanceKm, durationMins, tollAmount, parkingAmount] of routes) {
    for (const [a, b] of [
      [fromCity, toCity],
      [toCity, fromCity],
    ]) {
      await db.route.upsert({
        where: { fromCity_toCity: { fromCity: a, toCity: b } },
        update: {},
        create: { fromCity: a, toCity: b, distanceKm, durationMins, tollAmount, parkingAmount },
      });
    }
  }

  // Pickup / drop points (approximate coordinates — adjust in Admin -> Pickup points).
  const stops: [string, string, string, number, number][] = [
    ["Khatima", "Khatima Bus Stand", "Main Road, Khatima", 28.9213, 79.9701],
    ["Khatima", "Khatima Railway Station", "Station Road, Khatima", 28.9176, 79.9642],
    ["Khatima", "Main Market", "Main Bazaar, Khatima", 28.92, 79.971],
    ["Delhi", "Anand Vihar ISBT", "Anand Vihar, Delhi", 28.6469, 77.3159],
    ["Delhi", "Kashmere Gate ISBT", "Kashmere Gate, Delhi", 28.6675, 77.2283],
    ["Delhi", "Delhi Airport (T3)", "IGI Airport Terminal 3", 28.5562, 77.087],
    ["Delhi", "Akshardham Metro", "Akshardham, Delhi", 28.6185, 77.279],
  ];
  for (const [i, [city, name, address, lat, lng]] of stops.entries()) {
    await db.stop.upsert({ where: { city_name: { city, name } }, update: {}, create: { city, name, address, lat, lng, sortOrder: i } });
  }

  // Daily shared Ertiga: Khatima -> Delhi early morning, Delhi -> Khatima in the afternoon, next 14 days.
  const ertiga = await db.vehicle.findUniqueOrThrow({ where: { regNumber: "UK06TA1001" } });
  const out = await db.route.findUniqueOrThrow({ where: { fromCity_toCity: { fromCity: "Khatima", toCity: "Delhi" } } });
  const back = await db.route.findUniqueOrThrow({ where: { fromCity_toCity: { fromCity: "Delhi", toCity: "Khatima" } } });
  if ((await db.trip.count()) === 0) {
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.now() + i * 24 * 3600_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const dep1 = new Date(`${d}T05:00:00+05:30`);
      const dep2 = new Date(`${d}T14:00:00+05:30`);
      await db.trip.create({
        data: {
          routeId: out.id,
          vehicleId: ertiga.id,
          driverId: driverIds[0],
          departAt: dep1,
          arriveAt: new Date(dep1.getTime() + out.durationMins * 60_000),
          fare: 899,
          boardingPoint: "Please reach your pickup point 10 minutes early.",
        },
      });
      await db.trip.create({
        data: {
          routeId: back.id,
          vehicleId: ertiga.id,
          driverId: driverIds[0],
          departAt: dep2,
          arriveAt: new Date(dep2.getTime() + back.durationMins * 60_000),
          fare: 899,
          boardingPoint: "Please reach your pickup point 10 minutes early.",
        },
      });
    }
  }

  console.log("Seeded. Admin: admin@roadyatra.in / admin123 · Customer: 9999999999 / demo123 · Drivers: 9000000001, 9000000002 / driver123");
}

main().finally(() => db.$disconnect());
