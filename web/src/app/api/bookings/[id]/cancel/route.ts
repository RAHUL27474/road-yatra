import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";
import { canSeeBooking } from "@/lib/my-bookings";
import { bookingForApi, bookingInclude, cancelBooking, cancelSeats, cancellationQuote } from "@/lib/booking";
import { getSettings } from "@/lib/settings";

const schema = z.object({ seatNos: z.array(z.number().int().positive()).max(10).optional() });

// POST /api/bookings/:id/cancel { seatNos? } -> cancels the booking (or only those seats) with the refund shown in booking.cancellation
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  const booking = await db.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking || booking.userId !== user.id || !(await canSeeBooking(user, booking))) throw new HttpError(404, "Booking not found.");
  if (!cancellationQuote(booking, (await getSettings()).cancellationSlabs).allowed) {
    throw new HttpError(400, "This booking can no longer be cancelled online. Please call us.");
  }
  const { seatNos } = schema.parse(await req.json().catch(() => ({})));
  if (seatNos?.length) await cancelSeats(booking.id, seatNos);
  else await cancelBooking(booking.id, { by: "CUSTOMER", note: "Cancelled by customer" });
  const updated = await db.booking.findUniqueOrThrow({ where: { id }, include: bookingInclude });
  return ok({ booking: await bookingForApi(updated) });
});
