import { z } from "zod";
import { db } from "@/lib/db";
import { getRequestUser, revokeTokens } from "@/lib/auth";
import { handle, HttpError, ok } from "@/lib/http";

// GET /api/auth/me -> the logged-in user (401 if none). ?optional=1 answers { user: null } instead (website header).
export const GET = handle(async (req: Request) => {
  const user = await getRequestUser(req);
  if (!user && new URL(req.url).searchParams.get("optional") === "1") return ok({ user: null });
  if (!user) throw new HttpError(401, "Not logged in.");
  return ok({ user });
});

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email")]).optional(),
});

// PATCH /api/auth/me { name, email? } -> edit your own profile (the mobile number is the login and stays as it is)
export const PATCH = handle(async (req: Request) => {
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Not logged in.");
  const { name, email } = profileSchema.parse(await req.json());
  if (email && (await db.user.findFirst({ where: { email, NOT: { id: user.id } } }))) throw new HttpError(400, "Another account already uses this email.");
  const u = await db.user.update({ where: { id: user.id }, data: { name, ...(email !== undefined ? { email: email || null } : {}) } });
  return ok({ user: { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role } });
});

// DELETE /api/auth/me -> deletes a customer account (Google Play requires in-app deletion).
// Bookings stay for the business's tax records, but the account's name, email, phone and password are removed.
export const DELETE = handle(async (req: Request) => {
  const user = await getRequestUser(req);
  if (!user) throw new HttpError(401, "Not logged in.");
  if (user.role !== "CUSTOMER") throw new HttpError(400, "Staff accounts can't be deleted from the app. Please contact the office.");
  // A driver application holds licence and Aadhaar photos: the office deletes those, so it isn't done silently here.
  if (await db.driver.findUnique({ where: { userId: user.id }, select: { id: true } }))
    throw new HttpError(400, "This account has a driver application. Please contact the office to delete it with your documents.");
  const upcoming = await db.booking.count({ where: { userId: user.id, status: { in: ["PENDING", "CONFIRMED"] } } });
  if (upcoming) throw new HttpError(400, "You have an upcoming booking. Cancel it (or wait until the trip is over) before deleting your account.");
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { name: "Deleted user", email: null, phone: `deleted-${user.id}`, passwordHash: null, phoneVerified: false },
    }),
    // Past bookings stay for the GST records (amounts, dates, invoice numbers) but no longer name the person.
    db.booking.updateMany({ where: { userId: user.id }, data: { passengerName: "Deleted user", passengerPhone: "", ratingComment: null } }),
  ]);
  await revokeTokens(user.id);
  return ok({ ok: true });
});
