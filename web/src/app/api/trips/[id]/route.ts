import { db } from "@/lib/db";
import { handle, HttpError, ok } from "@/lib/http";
import { getTripDetail } from "@/lib/trips";
import { publicStop, returnDiscount } from "@/lib/booking";
import { getRequestUser } from "@/lib/auth";

// GET /api/trips/:id -> trip with taken seats and the pickup/drop points customers can choose
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const trip = await getTripDetail((await params).id);
  if (!trip) throw new HttpError(404, "Trip not found.");
  // The return-trip discount this customer would get, so the app shows the price that will be charged.
  const user = await getRequestUser(req);
  const discountPercent = user ? await returnDiscount(user.id, { departAt: trip.departAt, route: { fromCity: trip.fromCity, toCity: trip.toCity } }) : 0;
  const stops = await db.stop.findMany({
    where: { active: true, city: { in: [trip.fromCity, trip.toCity] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return ok({
    trip: {
      ...trip,
      discountPercent,
      pickupStops: stops.filter((s) => s.city === trip.fromCity).map(publicStop),
      dropStops: stops.filter((s) => s.city === trip.toCity).map(publicStop),
    },
  });
});
