import { handle, ok } from "@/lib/http";
import { quoteRental } from "@/lib/booking";
import { rentalSchema } from "@/lib/schemas";

// POST /api/rentals/quote  { rentalType, pickupCity, dropCity?, startAt, returnAt? }
export const POST = handle(async (req: Request) => {
  const data = rentalSchema.parse(await req.json());
  return ok(await quoteRental(data));
});
