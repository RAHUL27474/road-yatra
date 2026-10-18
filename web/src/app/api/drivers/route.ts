import { handle, ok } from "@/lib/http";
import { publicDrivers } from "@/lib/public-drivers";

// GET /api/drivers -> "Our drivers": name, photo, experience, trips done (public)
export const GET = handle(async () => ok({ drivers: await publicDrivers() }));
