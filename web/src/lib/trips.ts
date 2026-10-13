import { db } from "./db";
import { expireStaleHolds, getTakenSeats, publicVehicle } from "./booking";

/** Scheduled trips on a route for one IST calendar day (date = YYYY-MM-DD). */
export async function searchTrips(from: string, to: string, date: string) {
  await expireStaleHolds();
  const dayStart = new Date(`${date}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const now = new Date();

  const trips = await db.trip.findMany({
    where: {
      status: "SCHEDULED",
      route: { fromCity: from, toCity: to },
      departAt: { gte: dayStart > now ? dayStart : now, lt: dayEnd },
      vehicle: { active: true },
    },
    include: { route: true, vehicle: true, _count: { select: { seats: true } } },
    orderBy: { departAt: "asc" },
  });

  return trips.map((t) => ({
    id: t.id,
    fromCity: t.route.fromCity,
    toCity: t.route.toCity,
    departAt: t.departAt,
    arriveAt: t.arriveAt,
    durationMins: Math.round((t.arriveAt.getTime() - t.departAt.getTime()) / 60_000),
    fare: t.fare,
    boardingPoint: t.boardingPoint,
    dropPoint: t.dropPoint,
    seatsLeft: t.vehicle.seats - t._count.seats,
    vehicle: publicVehicle(t.vehicle),
  }));
}

export async function getTripDetail(id: string) {
  await expireStaleHolds();
  const t = await db.trip.findUnique({ where: { id }, include: { route: true, vehicle: true } });
  if (!t || t.status !== "SCHEDULED") return null;
  return {
    id: t.id,
    fromCity: t.route.fromCity,
    toCity: t.route.toCity,
    departAt: t.departAt,
    arriveAt: t.arriveAt,
    fare: t.fare,
    boardingPoint: t.boardingPoint,
    dropPoint: t.dropPoint,
    vehicle: publicVehicle(t.vehicle),
    takenSeats: await getTakenSeats(t.id),
  };
}
