import { z } from "zod";
import { handle, HttpError, ok } from "@/lib/http";
import { endRental, requireDriver, respondToDuty, startRental } from "@/lib/driver";

const schema = z.object({
  otp: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit OTP"),
  odometer: z.number().int().nonnegative().optional(),
});
const rejectSchema = z.object({ reason: z.string().trim().max(300).optional() });

// POST /api/driver/rentals/:id/start | /end { otp, odometer? }  (full-cab bookings)
// POST /api/driver/rentals/:id/accept | /reject { reason }
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const { id, action } = await params;
  const { user, driver } = await requireDriver(req);
  if (action === "accept" || action === "reject") {
    const { reason } = action === "reject" ? rejectSchema.parse(await req.json().catch(() => ({}))) : { reason: undefined };
    await respondToDuty(driver, user.name, "RENTAL", id, { accept: action === "accept", reason });
    return ok({ ok: true });
  }
  const body = schema.parse(await req.json());
  if (action === "start") {
    await startRental(driver.id, id, body);
    return ok({ ok: true });
  }
  if (action === "end") return ok(await endRental(driver.id, id, body));
  throw new HttpError(404, "Unknown action.");
});
