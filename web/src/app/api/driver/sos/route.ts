import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { raiseSos, requireDriver } from "@/lib/driver";

const schema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

// POST /api/driver/sos { lat?, lng? } -> alerts the office (and the driver's emergency contact), shows on the admin dashboard
export const POST = handle(async (req: Request) => {
  const { user, driver } = await requireDriver(req);
  return ok(await raiseSos(driver, user, schema.parse(await req.json().catch(() => ({})))));
});
