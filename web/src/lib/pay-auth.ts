import { db } from "./db";
import { getRequestUser, verifyToken } from "./auth";
import { HttpError } from "./http";

/** Payment calls are allowed for the booking owner, or anyone holding the booking's pay link token. */
export async function assertCanPay(req: Request, bookingId: string, payToken?: string) {
  if (payToken) {
    const p = await verifyToken<{ sub?: string; typ?: string }>(payToken);
    if (p?.typ === "pay" && p.sub === bookingId) return;
  }
  const user = await getRequestUser(req);
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { userId: true } });
  if (!user || !booking || booking.userId !== user.id) throw new HttpError(403, "This payment link is invalid or has expired.");
}
