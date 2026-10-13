import { db } from "@/lib/db";
import { getRequestUser, verifyToken } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";
import { getTrackingInfo } from "@/lib/tracking";

// GET /api/track/:bookingId?t=<view token> -> live status, vehicle position and ETA
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const t = new URL(req.url).searchParams.get("t");
  const p = t ? await verifyToken<{ sub?: string; typ?: string }>(t) : null;
  let allowed = p?.typ === "view" && p.sub === id;
  if (!allowed) {
    const user = await getRequestUser(req);
    const b = await db.booking.findUnique({ where: { id }, select: { userId: true } });
    allowed = !!user && !!b && (b.userId === user.id || user.role === "ADMIN");
  }
  if (!allowed) throw new HttpError(403, "This tracking link is invalid or has expired.");
  const info = await getTrackingInfo(id);
  if (!info) throw new HttpError(404, "Booking not found.");
  return ok(info);
});
