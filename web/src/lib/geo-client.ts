/** Browser location helpers (client components only). */

export type LatLng = { lat: number; lng: number };

/** The phone's / browser's current position. Throws Error(message) in plain words when it can't. */
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("This browser can't share your location."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Location is blocked. Allow location for this site in your browser settings, then try again."
              : "Couldn't find your location. Turn on GPS / location and try again.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}

/** Straight-line distance in km. */
export function distanceKm(a: LatLng, b: LatLng) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** The nearest of `items` that has coordinates, with its distance. */
export function nearest<T extends { lat: number | null; lng: number | null }>(from: LatLng, items: T[]) {
  let best: { item: T; km: number } | null = null;
  for (const item of items) {
    if (item.lat == null || item.lng == null) continue;
    const km = distanceKm(from, { lat: item.lat, lng: item.lng });
    if (!best || km < best.km) best = { item, km };
  }
  return best;
}

export const mapsLink = (p: LatLng) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;
