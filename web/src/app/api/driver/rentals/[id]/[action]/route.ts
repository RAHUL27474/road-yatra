import { z } from "zod";
import { handle, HttpError, ok } from "@/lib/http";
import { endRental, requireDriver, startRental } from "@/lib/driver";

const schema = z.object({
  otp: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit OTP"),
  odometer: z.number().int().nonnegative().optional(),
});

// POST /api/driver/rentals/:id/start | /end { otp, odometer? }  (full-cab bookings)
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const { id, action } = await params;
  const { driver } = await requireDriver(req);
  const body = schema.parse(await req.json());
  if (action === "start") {
    await startRental(driver.id, id, body);
    return ok({ ok: true });
  }
  if (action === "end") return ok(await endRental(driver.id, id, body));
  throw new HttpError(404, "Unknown action.");
});
