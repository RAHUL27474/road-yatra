// Live location sharing while a duty is in progress.
// - Foreground: Location.watchPositionAsync while the app is open.
// - Background: an expo-task-manager task fed by Location.startLocationUpdatesAsync, with an
//   Android foreground-service notification. It reads the token from SecureStore itself, because
//   it can run when the React tree (and the auth context) is not mounted.
// Both paths share one throttle so the server gets at most one fix every ~20 s.
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { api, ApiError, TOKEN_KEY } from './api';

export const LOCATION_TASK = 'ry-driver-location';
const INTERVAL_MS = 20_000;

let lastSentAt = 0;
let watcher: Location.LocationSubscription | null = null;
let askedBackground = false;
let active = false;
const listeners = new Set<(active: boolean) => void>();

function setActive(v: boolean) {
  if (active === v) return;
  active = v;
  listeners.forEach((l) => l(v));
}

/** Subscribe to "sharing on/off" changes (for the 📡 indicator). Returns an unsubscribe function. */
export function onSharingChange(l: (active: boolean) => void) {
  listeners.add(l);
  l(active);
  return () => void listeners.delete(l);
}

async function sendFix(loc: Location.LocationObject) {
  if (Date.now() - lastSentAt < INTERVAL_MS - 2_000) return;
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return stopLocationSharing();
  lastSentAt = Date.now();
  const { latitude, longitude, speed, heading } = loc.coords;
  try {
    await api('/api/driver/location', {
      token,
      body: {
        lat: latitude,
        lng: longitude,
        ...(speed != null && speed >= 0 ? { speed: Math.round(speed * 3.6 * 10) / 10 } : {}),
        ...(heading != null && heading >= 0 ? { heading: Math.round(heading) } : {}),
      },
    });
  } catch (e) {
    // 409: no trip in progress any more (ended from another device / the office). 401/403: logged out.
    if (e instanceof ApiError && [401, 403, 409].includes(e.status)) await stopLocationSharing();
    // Network errors: try again with the next fix.
  }
}

// Must be defined at module scope (imported from the root layout) so it exists when the OS wakes the app.
if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    await sendFix(data.locations[data.locations.length - 1]);
  });
}

/** Starts sharing (idempotent). Returns false if the driver refused location permission. */
export async function startLocationSharing(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    setActive(false);
    return false;
  }
  setActive(true);
  if (!watcher) {
    watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: INTERVAL_MS, distanceInterval: 0 },
      (loc) => void sendFix(loc),
    );
    // Send a first fix right away instead of waiting for the first watch callback.
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(sendFix, () => {});
  }
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return true;
    let bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted' && !askedBackground) {
      askedBackground = true;
      bg = await Location.requestBackgroundPermissionsAsync();
    }
    if (bg.status !== 'granted') return true; // foreground-only sharing
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: INTERVAL_MS,
      distanceInterval: 0,
      deferredUpdatesInterval: INTERVAL_MS,
      pausesUpdatesAutomatically: false,
      activityType: Location.LocationActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Sharing trip location',
        notificationBody: 'Road Yatra is sharing the vehicle location with passengers during your trip.',
        notificationColor: '#0b5ed7',
        killServiceOnDestroy: false,
      },
    });
  } catch (e) {
    // Expo Go has no background location; foreground sharing still works.
    console.warn('Background location unavailable:', e);
  }
  return true;
}

export async function stopLocationSharing() {
  watcher?.remove();
  watcher = null;
  setActive(false);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    // Task was never registered (e.g. Expo Go).
  }
}
