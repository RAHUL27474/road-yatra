import { z } from "zod";
import { handle, HttpError, ok } from "@/lib/http";
import { endTrip, requireDriver, respondToDuty, startTrip } from "@/lib/driver";

const rejectSchema = z.object({ reason: z.string().trim().max(300).optional() });

// POST /api/driver/trips/:id/start | /end  (scheduled seat trips)
// POST /api/driver/trips/:id/accept | /reject { reason }
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const { id, action } = await params;
  const { user, driver } = await requireDriver(req);
  if (action === "start") await startTrip(driver.id, id);
  else if (action === "end") await endTrip(driver.id, id);
  else if (action === "accept") await respondToDuty(driver, user.name, "TRIP", id, { accept: true });
  else if (action === "reject") {
    const { reason } = rejectSchema.parse(await req.json().catch(() => ({})));
    await respondToDuty(driver, user.name, "TRIP", id, { accept: false, reason });
  } else throw new HttpError(404, "Unknown action.");
  return ok({ ok: true });
});
