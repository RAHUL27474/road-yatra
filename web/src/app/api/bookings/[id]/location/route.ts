import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestUser, verifyToken } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";
import { canSeeBooking } from "@/lib/my-bookings";
import { bookingInclude, canShareLocation, SHARE_LOCATION_HOURS } from "@/lib/booking";

const schema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** The passenger's own booking: logged in (app / website), or the booking's view link (?t=, from WhatsApp). */
async function ownBooking(req: Request, id: string) {
  const booking = await db.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking) throw new HttpError(404, "Booking not found.");
  const t = new URL(req.url).searchParams.get("t");
  const p = t ? await verifyToken<{ sub?: string; typ?: string }>(t) : null;
  if (p?.typ === "view" && p.sub === id) return booking;
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  if (booking.userId !== user.id || !(await canSeeBooking(user, booking))) throw new HttpError(404, "Booking not found.");
  return booking;
}

// POST /api/bookings/:id/location { lat, lng } -> share the passenger's live location with the driver (latest point only)
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const booking = await ownBooking(req, id);
  if (!canShareLocation(booking))
    throw new HttpError(400, `You can share your location from ${SHARE_LOCATION_HOURS} hours before pickup until you board.`);
  const { lat, lng } = schema.parse(await req.json());
  const at = new Date();
  await db.booking.update({ where: { id }, data: { passengerLat: lat, passengerLng: lng, passengerLocAt: at } });
  return ok({ sharedLocation: { lat, lng, at } });
});

// DELETE /api/bookings/:id/location -> stop sharing (the driver no longer sees it)
export const DELETE = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await ownBooking(req, id);
  await db.booking.update({ where: { id }, data: { passengerLat: null, passengerLng: null, passengerLocAt: null } });
  return ok({ sharedLocation: null });
});
