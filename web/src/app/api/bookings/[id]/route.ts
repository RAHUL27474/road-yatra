import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";
import { bookingForApi, bookingInclude, expireStaleHolds } from "@/lib/booking";

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  await expireStaleHolds();
  const booking = await db.booking.findFirst({ where: { OR: [{ id }, { code: id }] }, include: bookingInclude });
  if (!booking || (booking.userId !== user.id && user.role !== "ADMIN")) throw new HttpError(404, "Booking not found.");
  return ok({ booking: await bookingForApi(booking) });
});
