import type { Duty, TripDuty } from './api';

// Formatting helpers. Times are always shown in IST (UTC+5:30), whatever the phone's timezone,
// computed by hand so they don't depend on the JS engine's Intl timezone data.
const IST_OFFSET_MS = 330 * 60_000;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** A Date whose UTC fields hold the IST wall-clock time. */
const ist = (d: string | number | Date) => new Date(new Date(d).getTime() + IST_OFFSET_MS);

/** ₹1,23,456 (Indian digit grouping). */
export function inr(amount: number) {
  const neg = amount < 0;
  const [int, dec] = Math.abs(Math.round(amount * 100) / 100).toFixed(2).split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}₹${rest ? rest + ',' + last3 : last3}${dec !== '00' ? '.' + dec : ''}`;
}

/** 14:05 */
export const fmtTime = (d: string | Date) => {
  const t = ist(d);
  return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
};

/** Fri, 2 Oct */
export const fmtDay = (d: string | Date) => {
  const t = ist(d);
  return `${DAYS[t.getUTCDay()]}, ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;
};

/** 2 Oct 2026 */
export const fmtDate = (d: string | Date) => {
  const t = ist(d);
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
};

/** "Today 14:05", "Tomorrow 06:00", "Sat, 3 Oct 06:00" */
export function fmtWhen(d: string | Date) {
  const day = ymdIST(new Date(d));
  const today = ymdIST(new Date());
  const label =
    day === today ? 'Today' : day === ymdIST(new Date(Date.now() + 86_400_000)) ? 'Tomorrow' : day === ymdIST(new Date(Date.now() - 86_400_000)) ? 'Yesterday' : fmtDay(d);
  return `${label} ${fmtTime(d)}`;
}

/** YYYY-MM-DD of the IST calendar day. */
export const ymdIST = (d: Date) => ist(d).toISOString().slice(0, 10);

/** "12 Mar 2031" for a YYYY-MM-DD calendar date. */
export const fmtYmd = (ymd: string) => fmtDate(`${ymd}T00:00:00+05:30`);

export const RENTAL_TYPE: Record<string, string> = {
  ONE_WAY: 'One Way',
  ROUND_TRIP: 'Round Trip',
  LOCAL: 'Local',
  AIRPORT: 'Airport Transfer',
};

export const bookedSeats = (d: TripDuty) => d.passengers.reduce((n, p) => n + p.seatNos.length, 0);
export const routeTitle = (d: Duty) => (d.toCity && d.toCity !== d.fromCity ? `${d.fromCity} → ${d.toCity}` : d.fromCity ?? 'Full cab');

/** "Today", "Tomorrow", "Yesterday" or "Sat, 3 Oct" (IST calendar day). */
export function fmtDayLabel(d: string | Date) {
  const day = ymdIST(new Date(d));
  if (day === ymdIST(new Date())) return 'Today';
  if (day === ymdIST(new Date(Date.now() + 86_400_000))) return 'Tomorrow';
  if (day === ymdIST(new Date(Date.now() - 86_400_000))) return 'Yesterday';
  return fmtDay(d);
}

/** "Monday, 5 October" for headers. */
export function fmtLongDate(d: string | Date) {
  const t = ist(d);
  const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${LONG_DAYS[t.getUTCDay()]}, ${t.getUTCDate()} ${LONG_MONTHS[t.getUTCMonth()]}`;
}
