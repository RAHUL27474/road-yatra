import { db } from "@/lib/db";
import { handle, HttpError, ok } from "@/lib/http";
import { getTripDetail } from "@/lib/trips";
import { publicStop } from "@/lib/booking";

// GET /api/trips/:id -> trip with taken seats and the pickup/drop points customers can choose
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const trip = await getTripDetail((await params).id);
  if (!trip) throw new HttpError(404, "Trip not found.");
  const stops = await db.stop.findMany({
    where: { active: true, city: { in: [trip.fromCity, trip.toCity] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return ok({
    trip: {
      ...trip,
      pickupStops: stops.filter((s) => s.city === trip.fromCity).map(publicStop),
      dropStops: stops.filter((s) => s.city === trip.toCity).map(publicStop),
    },
  });
});
