import * as Location from 'expo-location';
import { Linking } from 'react-native';

export type LatLng = { lat: number; lng: number };

/** Asks for location (while the app is open) and returns the current position. Throws Error(message) in plain words. */
export async function currentPosition(): Promise<LatLng> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted')
    throw new Error(perm.canAskAgain ? 'Location permission is needed for this.' : 'Location is turned off for this app. Allow it in Settings → Apps → Jai Shree Shyam Travels → Permissions.');
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Turn on Location (GPS) on your phone and try again.');
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: p.coords.latitude, lng: p.coords.longitude };
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

export const fmtDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

/** Opens the spot in Google Maps (or the phone's map app). */
export const openMap = (p: LatLng) => Linking.openURL(`https://www.google.com/maps?q=${p.lat},${p.lng}`).catch(() => {});
