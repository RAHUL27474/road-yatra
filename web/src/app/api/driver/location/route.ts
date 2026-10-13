import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireDriver, updateLocation } from "@/lib/driver";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().optional(),
  heading: z.number().optional(),
});

// POST /api/driver/location { lat, lng, speed?, heading? } -> send every 15-30 s during a trip
export const POST = handle(async (req: Request) => {
  const { driver } = await requireDriver(req);
  return ok(await updateLocation(driver.id, schema.parse(await req.json())));
});
