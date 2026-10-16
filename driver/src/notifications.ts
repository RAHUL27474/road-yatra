// Phone notifications made by the app itself (no push server needed):
// - "New duty" when a duty appears that the driver hasn't been told about (checked while the app is open,
//   and every ~15 min in the background by background.ts).
// - A once-a-day reminder when the licence or the vehicle's papers expire within 15 days.
import * as Notifications from 'expo-notifications';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { DriverInfo, Duty } from './api';
import { fmtWhen, routeTitle, ymdIST } from './format';
import { KEYS, load, save } from './storage';

const DUTY_CHANNEL = 'duties';
const REMINDER_CHANNEL = 'reminders';
const DOC_WARN_DAYS = 15;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let setup: Promise<boolean> | null = null;

/** Creates the Android channels and asks for permission once. Resolves false if the driver said no. */
export function ensureNotifications() {
  setup ??= (async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(DUTY_CHANNEL, {
        name: 'New duties',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
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

const dutyKey = (d: Duty) => `${d.kind}:${d.id}`;

/**
 * Returns the duties the driver has not been told about yet and remembers them.
 * The first run on a phone only records what is there, so installing the app doesn't fire a burst of alerts.
 */
export async function takeNewDuties(duties: Duty[]): Promise<Duty[]> {
  // duty key → its start time. Older app versions stored a plain list of keys.
  const raw = await load<Record<string, string> | string[] | null>(KEYS.knownDuties, null);
  const known: Record<string, string> | null = Array.isArray(raw) ? Object.fromEntries(raw.map((k) => [k, ''])) : raw;
  const now = Date.now();
  const next: Record<string, string> = {};
  // A duty that left the list while still inside the server's window (yesterday → 7 days ahead) was taken
  // away or turned down: forget it, so it alerts again if the office gives it back.
  for (const [k, at] of Object.entries(known ?? {})) {
    const t = at ? new Date(at).getTime() : 0;
    const inWindow = t >= now - 24 * 3600_000 && t <= now + 7 * 24 * 3600_000;
    if (!inWindow) next[k] = at;
  }
  for (const d of duties) next[dutyKey(d)] = d.startAt ?? '';
  await save(KEYS.knownDuties, Object.fromEntries(Object.entries(next).slice(-300)));
  if (!known) return [];
  return duties.filter((d) => d.status === 'SCHEDULED' && !(dutyKey(d) in known));
}

export async function notifyNewDuties(duties: Duty[]) {
  if (!duties.length || !(await ensureNotifications())) return;
  const first = duties[0];
  const title = duties.length === 1 ? `New duty: ${routeTitle(first)}` : `${duties.length} new duties`;
  const body =
    duties.length === 1
      ? `${first.kind === 'TRIP' ? 'Shared trip' : 'Full cab'} · ${fmtWhen(first.startAt)}${first.vehicle ? ` · ${first.vehicle.regNumber}` : ''}. Tap to accept.`
      : duties.map((d) => `${routeTitle(d)} · ${fmtWhen(d.startAt)}`).join('\n');
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', data: duties.length === 1 ? { kind: first.kind, id: first.id } : {} },
    trigger: Platform.OS === 'android' ? { channelId: DUTY_CHANNEL } : null,
  }).catch(() => {});
}

type DocWarning = { what: string; date: Date };

/** Licence and vehicle papers that expire within 15 days (or already have). */
export function expiringDocs(driver: DriverInfo | null, duties: Duty[]): DocWarning[] {
  const warnBy = Date.now() + DOC_WARN_DAYS * 86_400_000;
  const out: DocWarning[] = [];
  if (driver?.licenceExpiry && new Date(driver.licenceExpiry).getTime() < warnBy) out.push({ what: 'Driving licence', date: new Date(driver.licenceExpiry) });
  const seen = new Set<string>();
  for (const d of duties) {
    const v = d.vehicle;
    if (!v?.docs || seen.has(v.id) || d.status === 'COMPLETED') continue;
    seen.add(v.id);
    const docs: [string, string | null][] = [
      ['Insurance', v.docs.insurance],
      ['Permit', v.docs.permit],
      ['Fitness', v.docs.fitness],
      ['PUC', v.docs.puc],
    ];
    for (const [label, date] of docs) if (date && new Date(date).getTime() < warnBy) out.push({ what: `${v.regNumber} ${label}`, date: new Date(date) });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Once a day at most: a reminder notification listing papers that are about to expire. */
export async function remindExpiringDocs(driver: DriverInfo | null, duties: Duty[]) {
  const docs = expiringDocs(driver, duties);
  const today = ymdIST(new Date());
  if (!docs.length || (await load<string | null>(KEYS.docsRemindedOn, null)) === today || !(await ensureNotifications())) return;
  await save(KEYS.docsRemindedOn, today);
  const now = Date.now();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: docs.some((d) => d.date.getTime() < now) ? 'Papers expired — renew now' : 'Papers expiring soon',
      body: docs.map((d) => `${d.what}: ${d.date.getTime() < now ? 'expired' : 'expires'} ${d.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`).join('\n'),
      data: { screen: 'profile' },
    },
    trigger: Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL } : null,
  }).catch(() => {});
}

/** Opens the duty (or the profile) when the driver taps one of our notifications. */
export function useNotificationRouting(enabled: boolean) {
  // Wait for the navigator: a tap that cold-starts the app arrives before the screens are mounted.
  const navReady = !!useRootNavigationState()?.key;
  const active = enabled && navReady;
  useEffect(() => {
    if (!active) return;
    const open = (data: Record<string, unknown> | undefined) => {
      if (data?.kind === 'TRIP' && typeof data.id === 'string') router.push({ pathname: '/trip/[id]', params: { id: data.id } });
      else if (data?.kind === 'RENTAL' && typeof data.id === 'string') router.push({ pathname: '/rental/[id]', params: { id: data.id } });
      else if (data?.screen === 'profile') router.push('/profile');
    };
    // A tap that launched the app from closed.
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last.notification.request.content.data);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    return () => sub.remove();
  }, [active]);
}
