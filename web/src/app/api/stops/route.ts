import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { publicStop } from "@/lib/booking";

export const dynamic = "force-dynamic";

// GET /api/stops?city=Khatima -> pickup/drop points (all cities if no city given)
export async function GET(req: Request) {
  const city = new URL(req.url).searchParams.get("city")?.trim();
  const stops = await db.stop.findMany({ where: { active: true, ...(city ? { city } : {}) }, orderBy: [{ city: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
  return ok({ stops: stops.map(publicStop) });
}
