import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";
import { bookingForApi, bookingInclude, cancelBooking, cancellationQuote } from "@/lib/booking";
import { getSettings } from "@/lib/settings";

// POST /api/bookings/:id/cancel -> cancels with the refund shown in booking.cancellation
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  const booking = await db.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking || booking.userId !== user.id) throw new HttpError(404, "Booking not found.");
  if (!cancellationQuote(booking, (await getSettings()).cancellationSlabs).allowed) {
    throw new HttpError(400, "This booking can no longer be cancelled online. Please call us.");
  }
  await cancelBooking(booking.id, { by: "CUSTOMER", note: "Cancelled by customer" });
  const updated = await db.booking.findUniqueOrThrow({ where: { id }, include: bookingInclude });
  return ok({ booking: await bookingForApi(updated) });
});
