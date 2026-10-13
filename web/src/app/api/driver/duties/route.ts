import { handle, ok } from "@/lib/http";
import { listDuties, requireDriver } from "@/lib/driver";

// GET /api/driver/duties -> driver profile + trips/rentals from yesterday to 7 days ahead
export const GET = handle(async (req: Request) => {
  const { user, driver } = await requireDriver(req);
  return ok({
    driver: { name: user.name, phone: user.phone, licenceNo: driver.licenceNo, licenceExpiry: driver.licenceExpiry, photoUrl: driver.photoUrl },
    duties: await listDuties(driver.id),
  });
});
