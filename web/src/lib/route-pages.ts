import { db } from "./db";

/** "Khatima", "Delhi" → "khatima-to-delhi" (URL of the public route page). */
export const routeSlug = (from: string, to: string) => `${slug(from)}-to-${slug(to)}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Finds the route for a slug made by routeSlug. */
export async function routeFromSlug(s: string) {
  const routes = await db.route.findMany();
  return routes.find((r) => routeSlug(r.fromCity, r.toCity) === s) ?? null;
}
