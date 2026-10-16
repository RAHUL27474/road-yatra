import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";
import { canSeeBooking } from "@/lib/my-bookings";
import { phoneSchema } from "@/lib/schemas";
import { bookingForApi, changeBooking } from "@/lib/booking";

const schema = z.object({
  tripId: z.string().optional(),
  seatNos: z.array(z.number().int().positive()).max(10).optional(),
  seatPassengers: z
    .array(z.object({ seatNo: z.number().int().positive(), name: z.string().trim().max(80).optional(), phone: z.union([z.literal(""), phoneSchema]).optional(), female: z.boolean().optional() }))
    .max(10)
    .optional(),
  pickupStopId: z.string().optional(),
  dropStopId: z.string().optional(),
});

// POST /api/bookings/:id/change { tripId + seatNos (free date change, once) | pickupStopId / dropStopId }
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking || booking.userId !== user.id || !(await canSeeBooking(user, booking))) throw new HttpError(404, "Booking not found.");
  const updated = await changeBooking(booking.id, schema.parse(await req.json()));
  return ok({ booking: await bookingForApi(updated) });
});
