import { z } from "zod";
import { handle, HttpError, ok } from "@/lib/http";
import { collectCash, markNoShow, requireDriver } from "@/lib/driver";

const cashSchema = z.object({ mode: z.enum(["CASH", "UPI"]).default("CASH") });

// POST /api/driver/bookings/:id/no-show | /collect-cash { mode: CASH | UPI }
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const { id, action } = await params;
  const { driver } = await requireDriver(req);
  if (action === "no-show") {
    await markNoShow(driver.id, id);
    return ok({ ok: true });
  }
  if (action === "collect-cash") {
    const { mode } = cashSchema.parse(await req.json().catch(() => ({})));
    return ok(await collectCash(driver.id, id, mode));
  }
  throw new HttpError(404, "Unknown action.");
});
