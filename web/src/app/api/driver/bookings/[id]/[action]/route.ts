import { handle, HttpError, ok } from "@/lib/http";
import { collectCash, markNoShow, requireDriver } from "@/lib/driver";

// POST /api/driver/bookings/:id/no-show | /collect-cash
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const { id, action } = await params;
  const { driver } = await requireDriver(req);
  if (action === "no-show") {
    await markNoShow(driver.id, id);
    return ok({ ok: true });
  }
  if (action === "collect-cash") return ok(await collectCash(driver.id, id));
  throw new HttpError(404, "Unknown action.");
});
