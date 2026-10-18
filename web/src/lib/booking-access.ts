import { db } from "./db";
import { getCurrentUser, verifyToken } from "./auth";
import { bookingInclude } from "./booking";
import { canSeeBooking } from "./my-bookings";

/**
 * Loads a booking (by id or code) for a page, if the visitor may see it:
 * the logged-in owner, an admin, or someone holding a valid pay/view token for it
 * (used from the mobile app's browser, where nobody is logged in).
 */
export async function loadBookingForPage(idOrCode: string, token?: string, accept: ("pay" | "view")[] = ["pay"]) {
  const booking = await db.booking.findFirst({ where: { OR: [{ id: idOrCode }, { code: idOrCode }] }, include: bookingInclude });
  if (!booking) return null;
  const user = await getCurrentUser();
  if (user && (await canSeeBooking(user, booking))) return { booking, isOwner: user.id === booking.userId, isAdmin: user.role === "ADMIN" };
  if (token) {
    const p = await verifyToken<{ sub?: string; typ?: string }>(token);
    // "view" tokens travel in WhatsApp tracking links people forward to family: they must not reveal OTPs or QR codes.
    if (p?.typ && (accept as string[]).includes(p.typ) && p.sub === booking.id) return { booking, isOwner: false, isAdmin: false };
  }
  return null;
}
