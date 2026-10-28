import { requireAdminRequest } from "@/lib/admin-api";
import { adminVehicle } from "@/lib/admin-data";
import { handle, HttpError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdminRequest(req);
  const data = await adminVehicle((await params).id);
  if (!data) throw new HttpError(404, "Vehicle not found.");
  return ok(data);
});
