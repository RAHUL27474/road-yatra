export function inr(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function fmtTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export function fmtDateTime(d: Date | string) {
  return `${fmtDate(d)}, ${fmtTime(d)}`;
}

export function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const VEHICLE_TYPES: Record<string, string> = {
  SEDAN: "Sedan",
  HATCHBACK: "Hatchback",
  ERTIGA: "Ertiga / MUV",
  SUV: "SUV / Innova",
  INNOVA_CRYSTA: "Innova Crysta",
  TEMPO_TRAVELLER: "Tempo Traveller",
  BUS: "Bus",
  OTHER: "Other",
};

export const RENTAL_TYPES: Record<string, string> = {
  ONE_WAY: "One Way",
  ROUND_TRIP: "Round Trip",
  LOCAL: "Local (8 hr / 80 km)",
  AIRPORT: "Airport Transfer",
};

export const BLOCK_REASONS = ["DRIVER", "VIP", "CORPORATE", "OFFLINE", "EMERGENCY", "OPERATIONS"];

/** Date as YYYY-MM-DD in IST, for <input type="date"> values. */
export function ymd(d: Date | string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "";
}
