import { db } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";
import { createBookingSchema } from "@/lib/schemas";
import { visibleBookingsWhere } from "@/lib/my-bookings";
import { bookingForApi, bookingInclude, createRentalBooking, createSeatBooking, expireStaleHolds, payLink } from "@/lib/booking";

// GET /api/bookings -> the logged-in user's bookings
export const GET = handle(async (req: Request) => {
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  await expireStaleHolds();
  const bookings = await db.booking.findMany({
    where: { ...(await visibleBookingsWhere(user.id)), status: { not: "EXPIRED" } },
    include: bookingInclude,
    orderBy: { createdAt: "desc" },
  });
  return ok({ bookings: await Promise.all(bookings.map(bookingForApi)) });
});

// POST /api/bookings -> online payment: PENDING booking holding seats/vehicle until paid (payUrl returned);
//                       cash payment: CONFIRMED straight away, pay the driver.
export const POST = handle(async (req: Request) => {
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Please log in to book.");
  const data = createBookingSchema.parse(await req.json());
  const created =
    data.kind === "SEAT" ? await createSeatBooking({ ...data, userId: user.id }) : await createRentalBooking({ ...data, userId: user.id });
  const booking = await db.booking.findUniqueOrThrow({ where: { id: created.id }, include: bookingInclude });
  const pay = booking.status === "PENDING" ? await payLink(booking.id) : { payUrl: null, payToken: null };
  return ok({ booking: await bookingForApi(booking), ...pay }, 201);
});
