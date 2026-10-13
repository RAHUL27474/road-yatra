import type { RentalRequest, RentalType } from "./booking";

const TYPES = ["ONE_WAY", "ROUND_TRIP", "LOCAL", "AIRPORT"];

/** Parses ?type&pickup&drop&start&return (datetime-local values, treated as IST). */
export function parseHireParams(sp: Record<string, string | undefined>): RentalRequest | null {
  const { type, pickup, drop, start } = sp;
  if (!type || !TYPES.includes(type) || !pickup || !start) return null;
  const ist = (v: string) => new Date(v.length === 16 ? `${v}:00+05:30` : v);
  const startAt = ist(start);
  if (isNaN(startAt.getTime())) return null;
  const returnAt = sp.return ? ist(sp.return) : undefined;
  return { rentalType: type as RentalType, pickupCity: pickup, dropCity: drop, startAt, returnAt };
}

/** Rebuilds a query string from search params, optionally dropping some keys. */
export function toQuery(sp: Record<string, string | undefined>, omit: string[] = []) {
  return new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => !!e[1] && !omit.includes(e[0]))).toString();
}
