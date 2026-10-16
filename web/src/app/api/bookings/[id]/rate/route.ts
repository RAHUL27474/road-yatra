import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";
import { canSeeBooking } from "@/lib/my-bookings";
import { bookingForApi, bookingInclude, serializeBooking } from "@/lib/booking";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

// POST /api/bookings/:id/rate { rating: 1-5, comment? } -> once, after a completed trip
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  const booking = await db.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking || booking.userId !== user.id || !(await canSeeBooking(user, booking))) throw new HttpError(404, "Booking not found.");
  if (!serializeBooking(booking).canRate) throw new HttpError(400, booking.rating != null ? "You have already rated this trip." : "You can rate a trip after it is completed.");
  const { rating, comment } = schema.parse(await req.json());
  const updated = await db.booking.update({ where: { id }, data: { rating, ratingComment: comment || null, ratedAt: new Date() }, include: bookingInclude });
  return ok({ booking: await bookingForApi(updated) });
});
