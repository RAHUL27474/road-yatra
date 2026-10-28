import { requireAdminRequest } from "@/lib/admin-api";
import { adminBookings } from "@/lib/admin-data";
import { handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdminRequest(req);
  return ok(await adminBookings(Object.fromEntries(new URL(req.url).searchParams)));
});
