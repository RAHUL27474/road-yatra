import { handle, HttpError, ok } from "@/lib/http";
import { searchTrips } from "@/lib/trips";

// GET /api/trips/search?from=Delhi&to=Jaipur&date=2026-10-05
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();
  const date = url.searchParams.get("date");
  if (!from || !to || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "from, to and date (YYYY-MM-DD) are required.");
  return ok({ trips: await searchTrips(from, to, date) });
});
