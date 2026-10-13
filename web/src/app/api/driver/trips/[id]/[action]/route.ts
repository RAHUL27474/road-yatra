import { handle, HttpError, ok } from "@/lib/http";
import { endTrip, requireDriver, startTrip } from "@/lib/driver";

// POST /api/driver/trips/:id/start | /end  (scheduled seat trips)
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const { id, action } = await params;
  const { driver } = await requireDriver(req);
  if (action === "start") await startTrip(driver.id, id);
  else if (action === "end") await endTrip(driver.id, id);
  else throw new HttpError(404, "Unknown action.");
  return ok({ ok: true });
});
