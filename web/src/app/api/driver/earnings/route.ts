import { handle, ok } from "@/lib/http";
import { driverEarnings, requireDriver } from "@/lib/driver";

// GET /api/driver/earnings -> cash still held, per-day summary and completed duties of the last 30 days
export const GET = handle(async (req: Request) => {
  const { driver } = await requireDriver(req);
  return ok(await driverEarnings(driver.id));
});
