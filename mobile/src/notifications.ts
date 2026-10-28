// Phone notifications made by the app itself (no push server needed):
// - Trip reminders 2 hours and 30 minutes before departure, scheduled on the phone when a booking is seen.
// - "Booking confirmed", "Driver assigned", "Trip started", "Booking cancelled" when a booking changes
//   (checked while the app is open and every ~15 min in the background by background.ts).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { Booking } from './api';
import { fmtTime } from './format';

const UPDATES = 'updates';
const REMINDERS = 'reminders';
const SNAPSHOT = 'ry_notify_snapshot';
const SCHEDULED = 'ry_notify_scheduled';
const REMIND_BEFORE_MIN = [120, 30];

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let setup: Promise<boolean> | null = null;

/** Creates the Android channels and asks for permission once. Resolves false if the passenger said no. */
export function ensureNotifications() {
  setup ??= (async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(UPDATES, { name: 'Booking updates', importance: Notifications.AndroidImportance.HIGH, sound: 'default' });
      await Notifications.setNotificationChannelAsync(REMINDERS, { name: 'Trip reminders', importance: Notifications.AndroidImportance.HIGH, sound: 'default' });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  })().catch(() => {
    setup = null;
    return false;
  });
  return setup;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const writeJson = (key: string, v: unknown) => AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});

const route = (b: Booking) => {
  const from = b.trip?.fromCity ?? b.pickupCity ?? '';
  const to = b.trip?.toCity ?? b.dropCity;
  return to && to !== from ? `${from} → ${to}` : from || 'your trip';
};
const startOf = (b: Booking) => b.trip?.departAt ?? b.startAt;

type Snap = { status: string; tripStatus: string; driver: string | null; late?: boolean; near?: boolean };
const NEAR_MIN = 10;
const snap = (b: Booking): Snap => ({
  status: b.status,
  tripStatus: b.tripStatus,
  driver: b.driver?.name ?? null,
  late: !!b.runningLate,
  near: b.etaMinutes != null && b.etaMinutes <= NEAR_MIN,
});

function changeMessage(b: Booking, before: Snap): { title: string; body: string } | null {
  const now = snap(b);
  if (before.status === 'PENDING' && now.status === 'CONFIRMED') return { title: 'Booking confirmed', body: `${route(b)} · PNR ${b.code}. Your e-ticket is ready.` };
  if (before.status !== 'CANCELLED' && now.status === 'CANCELLED') return { title: 'Booking cancelled', body: `${route(b)} · PNR ${b.code}${b.refundAmount ? ` · refund ₹${b.refundAmount}` : ''}.` };
  if (now.status !== 'CONFIRMED') return null;
  if (!before.near && now.near) return { title: `Vehicle ${b.etaMinutes} min away`, body: `Please be ready at ${b.pickupStop?.name ?? 'your pickup point'}${b.vehicleNumber ? ` · ${b.vehicleNumber}` : ''}.` };
  if (before.tripStatus !== 'STARTED' && now.tripStatus === 'STARTED') return { title: 'Your trip has started', body: `${route(b)} is on the way. Open the ticket to track the vehicle.` };
  if (!before.late && now.late) return { title: 'Running a little late', body: `${route(b)} hasn't left yet. The driver will call you, or contact the office from your ticket.` };
  if (!before.driver && now.driver)
    return { title: 'Driver assigned', body: `${now.driver}${b.vehicleNumber ? ` · ${b.vehicleNumber}` : ''} for ${route(b)} at ${startOf(b) ? fmtTime(startOf(b)!) : ''}.` };
  return null;
}

/**
 * Compares bookings with what the phone saw last time and notifies about changes.
 * `silent` only records the new state (used when the passenger is looking at the screen anyway).
 */
export async function checkBookingUpdates(bookings: Booking[], silent = false) {
  const before = await readJson<Record<string, Snap> | null>(SNAPSHOT, null);
  // Merge: a single ticket screen passes one booking and must not forget the others.
  const next: Record<string, Snap> = { ...(before ?? {}) };
  const messages: { b: Booking; title: string; body: string }[] = [];
  for (const b of bookings) {
    next[b.id] = snap(b);
    const prev = before?.[b.id];
    const m = prev && changeMessage(b, prev);
    if (m) messages.push({ b, ...m });
  }
  await writeJson(SNAPSHOT, Object.fromEntries(Object.entries(next).slice(-200)));
  if (silent || !before || !messages.length || !(await ensureNotifications())) return;
  for (const m of messages.slice(0, 3))
    await Notifications.scheduleNotificationAsync({
      content: { title: m.title, body: m.body, sound: 'default', data: { bookingId: m.b.id } },
      trigger: Platform.OS === 'android' ? { channelId: UPDATES } : null,
    }).catch(() => {});
}

/**
 * Keeps exactly one set of departure reminders per upcoming confirmed booking (and none for cancelled ones).
 * Pass the full list from /api/bookings; with `partial` (one ticket) only those bookings are touched.
 */
let reminderLock: Promise<void> = Promise.resolve();
export function syncTripReminders(bookings: Booking[], partial = false): Promise<void> {
  // One at a time: the list screen, a ticket and the background task can all call this together.
  const run = reminderLock.then(() => syncTripRemindersNow(bookings, partial));
  reminderLock = run.catch(() => {});
  return run;
}

async function syncTripRemindersNow(bookings: Booking[], partial: boolean) {
  const given = new Set(bookings.map((b) => b.id));
  const scheduled = await readJson<Record<string, { at: string; ids: string[] }>>(SCHEDULED, {});
  const wanted = new Map<string, Booking>();
  for (const b of bookings) {
    const at = startOf(b);
    if (b.status === 'CONFIRMED' && b.tripStatus === 'SCHEDULED' && at && new Date(at).getTime() > Date.now()) wanted.set(b.id, b);
  }
  // Drop reminders for bookings that were cancelled, finished or moved to another time.
  for (const [id, s] of Object.entries(scheduled)) {
    if (partial && !given.has(id)) continue;
    const b = wanted.get(id);
    if (b && startOf(b) === s.at) continue;
    await Promise.all(s.ids.map((n) => Notifications.cancelScheduledNotificationAsync(n).catch(() => {})));
    delete scheduled[id];
  }
  const toAdd = [...wanted.values()].filter((b) => !scheduled[b.id]);
  if (toAdd.length && (await ensureNotifications())) {
    for (const b of toAdd) {
      const at = new Date(startOf(b)!);
      const ids: string[] = [];
      for (const min of REMIND_BEFORE_MIN) {
        const when = new Date(at.getTime() - min * 60_000);
        if (when.getTime() < Date.now() + 60_000) continue;
        const pickup = b.pickupStop?.name ?? b.pickupAddress ?? '';
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: min >= 60 ? `Trip in ${min / 60} hours` : `Trip in ${min} minutes`,
            body: `${route(b)} at ${fmtTime(at)}${pickup ? ` from ${pickup}` : ''}. Keep your QR ticket ready.`,
            sound: 'default',
            data: { bookingId: b.id },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, ...(Platform.OS === 'android' ? { channelId: REMINDERS } : {}) },
        }).catch(() => null);
        if (id) ids.push(id);
      }
      scheduled[b.id] = { at: startOf(b)!, ids };
    }
  }
  await writeJson(SCHEDULED, scheduled);
}

/** Logout: cancel every reminder this account scheduled. */
export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

/** Opens the ticket when the passenger taps one of our notifications. */
export function useNotificationRouting(enabled: boolean) {
  // Wait for the navigator: a tap that cold-starts the app arrives before the screens are mounted.
  const navReady = !!useRootNavigationState()?.key;
  // The web preview has no notification responses (the call throws there).
  const active = enabled && navReady && Platform.OS !== 'web';
  useEffect(() => {
    if (!active) return;
    const open = (data: Record<string, unknown> | undefined) => {
      if (typeof data?.bookingId === 'string') router.push({ pathname: '/booking/[id]', params: { id: data.bookingId } });
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last.notification.request.content.data);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    return () => sub.remove();
  }, [active]);
}
