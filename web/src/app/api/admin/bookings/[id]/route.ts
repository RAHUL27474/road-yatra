import { requireAdminRequest } from "@/lib/admin-api";
import { adminBookingDetail } from "@/lib/admin-data";
import { handle, HttpError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdminRequest(req);
  const data = await adminBookingDetail((await params).id);
  if (!data) throw new HttpError(404, "Booking not found.");
  return ok(data);
});
