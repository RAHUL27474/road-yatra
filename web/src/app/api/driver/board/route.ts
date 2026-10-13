import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { boardPassenger, requireDriver } from "@/lib/driver";

const schema = z.object({ bookingId: z.string().optional(), qr: z.string().optional(), otp: z.string().optional() });

// POST /api/driver/board { qr } or { bookingId, otp } -> { name, seatNos, amountDue }
export const POST = handle(async (req: Request) => {
  const { driver } = await requireDriver(req);
  return ok(await boardPassenger(driver.id, schema.parse(await req.json())));
});
