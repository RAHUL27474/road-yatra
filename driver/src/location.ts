// Live location sharing while a duty is in progress.
// - Foreground: Location.watchPositionAsync while the app is open.
// - Background: an expo-task-manager task fed by Location.startLocationUpdatesAsync, with an
//   Android foreground-service notification. It reads the token from SecureStore itself, because
//   it can run when the React tree (and the auth context) is not mounted.
// Both paths share one throttle so the server gets at most one fix every ~20 s.
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';
import { api, ApiError, TOKEN_KEY } from './api';

export const LOCATION_TASK = 'ry-driver-location';
const INTERVAL_MS = 20_000;

let lastSentAt = 0;
let watcher: Location.LocationSubscription | null = null;
let askedBackground = false;
let active = false;
// Start/stop run one at a time (a stop always lands after an earlier start), and a start abandons itself if a
// stop was asked for while it waited on a permission prompt.
let gen = 0;
let lock: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => {});
  return run;
}
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

/** In-app disclosure shown before asking for background location. Resolves true if the driver chose to continue. */
function explainBackgroundLocation() {
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      'Share location during trips',
      'JSS Travels Driver collects your location while a trip is in progress — even when the app is closed or the screen is off — so passengers and the office can see where the vehicle is.\n\nLocation is only shared between "Start trip" and "End trip". On the next screen, choose "Allow all the time".',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    ),
  );
}

/** Starts sharing (idempotent). Returns false if the driver refused location permission. */
export function startLocationSharing(): Promise<boolean> {
  const my = gen;
  return serial(() => startNow(my));
}

export function stopLocationSharing(): Promise<void> {
  gen++;
  return serial(stopNow);
}

async function startNow(my: number): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (my !== gen) return false;
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
      // Google Play requires this explanation, in the app, before the system "Allow all the time" prompt.
      if (await explainBackgroundLocation()) bg = await Location.requestBackgroundPermissionsAsync();
    }
    if (my !== gen) return false; // trip ended / logged out while the driver was reading the prompt
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
        notificationBody: 'JSS Travels is sharing the vehicle location with passengers during your trip.',
        notificationColor: '#1E4FD8',
        killServiceOnDestroy: false,
      },
    });
  } catch (e) {
    // Expo Go has no background location; foreground sharing still works.
    console.warn('Background location unavailable:', e);
  }
  return true;
}

async function stopNow() {
  watcher?.remove();
  watcher = null;
  setActive(false);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    // Task was never registered (e.g. Expo Go).
  }
}
