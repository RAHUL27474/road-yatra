import { db } from "./db";
import { bookingInclude, serializeBooking } from "./booking";

const AVG_SPEED_KMH = 45; // average intercity speed incl. stops, for a rough ETA
const ROAD_FACTOR = 1.3; // roads are longer than a straight line
const STALE_MINUTES = 10;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** A point to aim for in a city when the booking has no specific stop: its first stop with coordinates. */
async function cityPoint(city: string | null | undefined) {
  if (!city) return null;
  const s = await db.stop.findFirst({ where: { city, lat: { not: null }, lng: { not: null } }, orderBy: { sortOrder: "asc" } });
  return s ? { lat: s.lat!, lng: s.lng!, name: s.name } : null;
}

/** Everything the public tracking page shows for one booking. */
export async function getTrackingInfo(bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!b) return null;
  const s = serializeBooking(b);
  const vehicleId = b.trip?.vehicleId ?? b.vehicleId;
  const loc = vehicleId ? await db.vehicleLocation.findUnique({ where: { vehicleId } }) : null;
  const moving = s.tripStatus === "STARTED";
  const location = moving && loc ? { lat: loc.lat, lng: loc.lng, speed: loc.speed, updatedAt: loc.updatedAt, stale: Date.now() - loc.updatedAt.getTime() > STALE_MINUTES * 60_000 } : null;

  const pickup =
    b.pickupStop?.lat != null ? { lat: b.pickupStop.lat, lng: b.pickupStop.lng!, name: b.pickupStop.name } : await cityPoint(s.trip?.fromCity ?? b.pickupCity);
  const drop =
    b.dropStop?.lat != null ? { lat: b.dropStop.lat, lng: b.dropStop.lng!, name: b.dropStop.name } : await cityPoint(s.trip?.toCity ?? b.dropCity);

  // Before the passenger is on board, the ETA is to their pickup; afterwards, to the drop.
  const onBoard = !!b.boardedAt || !!b.startedAt;
  const target = onBoard ? drop : pickup;
  const etaMins = location && target ? Math.round(((haversineKm(location, target) * ROAD_FACTOR) / AVG_SPEED_KMH) * 60) : null;

  return {
    code: b.code,
    status: b.status,
    tripStatus: s.tripStatus,
    title: s.trip ? `${s.trip.fromCity} → ${s.trip.toCity}` : `${b.pickupCity}${b.dropCity ? ` → ${b.dropCity}` : ""}`,
    startAt: s.startAt,
    driver: s.driver,
    vehicle: s.vehicle ? { name: s.vehicle.name, number: s.vehicleNumber } : null,
    pickup,
    drop,
    onBoard,
    location,
    eta: etaMins != null && target ? { minutes: etaMins, to: onBoard ? "drop" : "pickup", place: target.name } : null,
  };
}
