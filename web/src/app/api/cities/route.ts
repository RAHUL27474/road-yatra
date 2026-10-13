import { db } from "@/lib/db";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** All cities that appear on at least one route, sorted A–Z. */
export async function GET() {
  const routes = await db.route.findMany({ select: { fromCity: true, toCity: true } });
  const cities = [...new Set(routes.flatMap((r) => [r.fromCity, r.toCity]))].sort();
  return ok({ cities });
}
