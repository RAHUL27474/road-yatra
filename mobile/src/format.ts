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

/** Fri, 2 Oct 2026 */
export const fmtDate = (d: string | Date) => {
  const t = ist(d);
  return `${DAYS[t.getUTCDay()]}, ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
};

export const fmtDateTime = (d: string | Date) => `${fmtDate(d)}, ${fmtTime(d)}`;

/** 5h 30m */
export const fmtDuration = (mins: number) => `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`;

/** YYYY-MM-DD of the IST calendar day. */
export const ymdIST = (d: Date) => ist(d).toISOString().slice(0, 10);

/** The next `n` IST calendar days (today first), for date chips. */
export function nextDays(n: number) {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const t = ist(now + i * 86_400_000);
    return {
      ymd: t.toISOString().slice(0, 10),
      day: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYS[t.getUTCDay()],
      date: `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`,
    };
  });
}

/** "Sat, 3 Oct" from YYYY-MM-DD. */
export const fmtYmd = (ymd: string) => {
  const t = new Date(ymd + 'T00:00:00Z');
  return `${DAYS[t.getUTCDay()]}, ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
};

/** "Sun, 11 Oct" from YYYY-MM-DD. */
export const fmtYmdShort = (ymd: string) => {
  const t = new Date(ymd + 'T00:00:00Z');
  return `${DAYS[t.getUTCDay()]}, ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;
};

/** "Sun, 11 Oct" for an ISO time, in IST. */
export const fmtDateShort = (d: string | Date) => {
  const t = ist(d);
  return `${DAYS[t.getUTCDay()]}, ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Today", "Tomorrow" or the weekday name ("Wednesday") for a YYYY-MM-DD. */
export function relativeDay(ymd: string) {
  const [today, tomorrow] = nextDays(2);
  if (ymd === today.ymd) return 'Today';
  if (ymd === tomorrow.ymd) return 'Tomorrow';
  return WEEKDAYS[new Date(ymd + 'T00:00:00Z').getUTCDay()];
}

/** Days between the IST calendar dates of two times (for the "+1" next-day marker). */
export const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(ymdIST(new Date(to))) - Date.parse(ymdIST(new Date(from)))) / 86_400_000);

/** State / region caption under a city name. Unknown cities get no caption. */
const REGION: Record<string, string> = {
  Khatima: 'Uttarakhand',
  Haldwani: 'Uttarakhand',
  Rudrapur: 'Uttarakhand',
  Pantnagar: 'Uttarakhand',
  Dehradun: 'Uttarakhand',
  Delhi: 'Delhi NCR',
  Bareilly: 'Uttar Pradesh',
  Moradabad: 'Uttar Pradesh',
};
export const cityRegion = (city: string) => REGION[city] ?? '';

export const VEHICLE_TYPE: Record<string, string> = {
  SEDAN: 'Sedan',
  HATCHBACK: 'Hatchback',
  ERTIGA: 'Ertiga / MUV',
  SUV: 'SUV',
  INNOVA_CRYSTA: 'Innova Crysta',
  TEMPO_TRAVELLER: 'Tempo Traveller',
  BUS: 'Bus',
  OTHER: 'Vehicle',
};

export const RENTAL_TYPE: Record<string, string> = {
  ONE_WAY: 'One Way',
  ROUND_TRIP: 'Round Trip',
  LOCAL: 'Local (8 hr / 80 km)',
  AIRPORT: 'Airport Transfer',
};
