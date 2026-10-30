import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** All cities that appear on at least one route, sorted A–Z. Cached; route edits clear it (tag "home"). */
const cities = unstable_cache(
  async () => {
    const routes = await db.route.findMany({ select: { fromCity: true, toCity: true } });
    return [...new Set(routes.flatMap((r) => [r.fromCity, r.toCity]))].sort();
  },
  ["api-cities"],
  { revalidate: 300, tags: ["home"] },
);

export async function GET() {
  return ok({ cities: await cities() });
}
