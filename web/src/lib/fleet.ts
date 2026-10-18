import { db } from "./db";
import { HttpError } from "./http";

const key = (routeId: string, vehicleId: string) => `${routeId}:${vehicleId}`;

/** Every (route, vehicle) the office switched off, as "routeId:vehicleId" keys. */
export async function offPairs() {
  const rows = await db.routeVehicleOff.findMany({ select: { routeId: true, vehicleId: true } });
  return new Set(rows.map((r) => key(r.routeId, r.vehicleId)));
}

export const isOffIn = (off: Set<string>, routeId: string, vehicleId: string) => off.has(key(routeId, vehicleId));

/** Refuses a booking for a vehicle the office switched off on this route (either direction for full cabs). */
export async function assertRunsOnRoute(routeIds: string[], vehicleId: string) {
  const off = await db.routeVehicleOff.findFirst({ where: { routeId: { in: routeIds }, vehicleId } });
  if (off) throw new HttpError(400, "This vehicle is not running on this route right now. Please choose another trip or vehicle.");
}
