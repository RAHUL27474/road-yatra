import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { publicStop } from "@/lib/booking";

export const dynamic = "force-dynamic";

/** Active pickup/drop points, per city or all. Cached; pickup-point edits clear it (tag "home"). */
const stopsFor = unstable_cache(
  async (city: string) => {
    const stops = await db.stop.findMany({ where: { active: true, ...(city ? { city } : {}) }, orderBy: [{ city: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
    return stops.map(publicStop);
  },
  ["api-stops"],
  { revalidate: 300, tags: ["home"] },
);

// GET /api/stops?city=Khatima -> pickup/drop points (all cities if no city given)
export async function GET(req: Request) {
  const city = new URL(req.url).searchParams.get("city")?.trim() ?? "";
  return ok({ stops: await stopsFor(city) });
}
