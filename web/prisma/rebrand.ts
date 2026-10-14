// One-off update of an existing database to Jai Shree Shyam Tour & Travels' real details.
// Safe to run more than once. Run with: npx tsx prisma/rebrand.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Business details printed on invoices
  await db.setting.upsert({
    where: { key: "business" },
    update: {},
    create: { key: "business", value: "{}" },
  });
  const current = JSON.parse((await db.setting.findUniqueOrThrow({ where: { key: "business" } })).value || "{}");
  const business = {
    ...current,
    legalName: "Jai Shree Shyam Tour & Travels",
    gstin: "05GFGPK7444D1ZH",
    address: "17 Meel, Pachpeda, Khatima\nUdham Singh Nagar, Uttarakhand",
    stateName: "Uttarakhand",
    stateCode: "05",
    sacCode: current.sacCode || "9964",
    email: "info@jaishreeshyamtravels.com",
  };
  await db.setting.update({ where: { key: "business" }, data: { value: JSON.stringify(business) } });

  // Fleet (registration numbers are placeholders — change them in Admin → Vehicles)
  const fleet = [
    { regNumber: "UK06TA1001", name: "Maruti Ertiga (7 seater)", type: "ERTIGA", seats: 6, seatsPerRow: 3, aisleAfter: 0, allowSeatBooking: true, ratePerKm: 13, driverAllowance: 400, localPackage: 2200, airportFare: 1800 },
    { regNumber: "UK06TA1002", name: "Maruti Dzire (New model)", type: "SEDAN", seats: 4, seatsPerRow: 2, aisleAfter: 0, allowSeatBooking: true, ratePerKm: 11, driverAllowance: 350, localPackage: 1800, airportFare: 1400 },
    { regNumber: "UK06TA1003", name: "Maruti Dzire (Old model)", type: "SEDAN", seats: 4, seatsPerRow: 2, aisleAfter: 0, allowSeatBooking: false, ratePerKm: 10, driverAllowance: 350, localPackage: 1600, airportFare: 1300 },
    { regNumber: "UK06TA1004", name: "Tata Altroz", type: "HATCHBACK", seats: 4, seatsPerRow: 2, aisleAfter: 0, allowSeatBooking: false, ratePerKm: 10, driverAllowance: 350, localPackage: 1600, airportFare: 1300 },
  ];
  for (const v of fleet) {
    const data = { ...v, amenities: "AC,Music,Charging Point", allowRental: true, minKmPerDay: 250, tollFactor: 1, active: true };
    await db.vehicle.upsert({ where: { regNumber: v.regNumber }, update: data, create: data });
  }

  // Routes from Khatima: [to, km, minutes, toll (car, one way), parking]. Approximate — adjust in Admin → Routes & fares.
  const routes: [string, number, number, number, number][] = [
    ["Delhi", 290, 420, 450, 100],
    ["Haridwar", 280, 420, 300, 50],
    ["Rishikesh", 300, 480, 300, 50],
    ["Nainital", 110, 210, 0, 100],
    ["Mussoorie", 340, 570, 300, 100],
    ["Auli", 400, 720, 0, 100],
  ];
  for (const [to, distanceKm, durationMins, tollAmount, parkingAmount] of routes) {
    for (const [a, b] of [
      ["Khatima", to],
      [to, "Khatima"],
    ]) {
      const data = { distanceKm, durationMins, tollAmount, parkingAmount };
      await db.route.upsert({ where: { fromCity_toCity: { fromCity: a, toCity: b } }, update: data, create: { fromCity: a, toCity: b, ...data } });
    }
  }

  // Pickup / drop points in Delhi and Haridwar (approximate coordinates — adjust in Admin → Pickup points)
  const stops: [string, string, string, number, number, number][] = [
    ["Delhi", "Anand Vihar ISBT", "Anand Vihar, Delhi", 28.6469, 77.3159, 0],
    ["Delhi", "Kashmere Gate ISBT", "Kashmere Gate, Delhi", 28.6675, 77.2283, 1],
    ["Delhi", "New Delhi Railway Station", "Paharganj side, New Delhi", 28.643, 77.2194, 2],
    ["Delhi", "Old Delhi Railway Station", "Chandni Chowk, Delhi", 28.6612, 77.2276, 3],
    ["Delhi", "Hazrat Nizamuddin Railway Station", "Nizamuddin, New Delhi", 28.5893, 77.2531, 4],
    ["Delhi", "Anand Vihar Railway Terminal", "Anand Vihar, Delhi", 28.6502, 77.3152, 5],
    ["Delhi", "Sarai Kale Khan ISBT", "Ring Road, Sarai Kale Khan, Delhi", 28.5886, 77.256, 6],
    ["Delhi", "Delhi Airport (T1)", "IGI Airport Terminal 1, Domestic", 28.5665, 77.1031, 7],
    ["Delhi", "Delhi Airport (T3)", "IGI Airport Terminal 3", 28.5562, 77.087, 8],
    ["Delhi", "Akshardham Metro", "Akshardham, Delhi", 28.6185, 77.279, 9],
    ["Delhi", "Noida Sector 62", "Sector 62, Noida", 28.6271, 77.3725, 10],
    ["Haridwar", "Har Ki Pauri", "Har Ki Pauri, Haridwar", 29.9561, 78.1702, 0],
    ["Haridwar", "Haridwar Railway Station", "Railway Road, Haridwar", 29.9475, 78.1601, 1],
    ["Haridwar", "Haridwar Bus Stand (ISBT)", "Delhi–Haridwar Road, Haridwar", 29.9457, 78.1555, 2],
  ];
  for (const [city, name, address, lat, lng, sortOrder] of stops) {
    await db.stop.upsert({ where: { city_name: { city, name } }, update: { sortOrder }, create: { city, name, address, lat, lng, sortOrder } });
  }

  // Shared fare ₹800 per seat on upcoming Khatima ⇄ Delhi trips
  const updated = await db.trip.updateMany({ where: { status: "SCHEDULED", departAt: { gt: new Date() } }, data: { fare: 800 } });

  // Daily shared Dzire: Khatima → Haridwar 06:00, Haridwar → Khatima 15:00 for the next 14 days
  const dzire = await db.vehicle.findUniqueOrThrow({ where: { regNumber: "UK06TA1002" } });
  const out = await db.route.findUniqueOrThrow({ where: { fromCity_toCity: { fromCity: "Khatima", toCity: "Haridwar" } } });
  const back = await db.route.findUniqueOrThrow({ where: { fromCity_toCity: { fromCity: "Haridwar", toCity: "Khatima" } } });
  let created = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.now() + i * 24 * 3600_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    for (const [route, time] of [
      [out, "06:00"],
      [back, "15:00"],
    ] as const) {
      const departAt = new Date(`${d}T${time}:00+05:30`);
      if (departAt < new Date()) continue;
      const exists = await db.trip.findFirst({ where: { routeId: route.id, vehicleId: dzire.id, departAt } });
      if (exists) continue;
      await db.trip.create({
        data: {
          routeId: route.id,
          vehicleId: dzire.id,
          departAt,
          arriveAt: new Date(departAt.getTime() + route.durationMins * 60_000),
          fare: 800,
          boardingPoint: "Please reach your pickup point 10 minutes early.",
        },
      });
      created++;
    }
  }

  console.log(`Done. Fleet: ${fleet.length} vehicles · ${routes.length * 2} routes · ${updated.count} trips set to ₹800 · ${created} Haridwar trips added.`);
}

main().finally(() => db.$disconnect());
