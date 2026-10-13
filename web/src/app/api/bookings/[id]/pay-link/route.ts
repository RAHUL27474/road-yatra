import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";
import { expireStaleHolds, payLink } from "@/lib/booking";

// POST /api/bookings/:id/pay-link -> a fresh { payUrl, payToken } for the owner's PENDING booking
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  await expireStaleHolds();
  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking || booking.userId !== user.id) throw new HttpError(404, "Booking not found.");
  if (booking.status !== "PENDING") throw new HttpError(400, "This booking is no longer awaiting payment.");
  return ok(await payLink(booking.id));
});
