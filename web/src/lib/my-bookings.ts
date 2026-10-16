import { db } from "./db";

/**
 * Bookings the office enters for a mobile number (phone / walk-in, source OFFLINE) are attached to whatever
 * account owns that number. While sign-up works without a delivered OTP, anyone could register someone
 * else's number, so those bookings — with their boarding OTPs — are only shown once the account has proved
 * the number with a real OTP (User.phoneVerified). The customer's own online bookings are always shown.
 */
async function phoneVerified(userId: string) {
  return !!(await db.user.findUnique({ where: { id: userId }, select: { phoneVerified: true } }))?.phoneVerified;
}

/** Prisma `where` for the bookings this account may see. */
export async function visibleBookingsWhere(userId: string) {
  return (await phoneVerified(userId)) ? { userId } : { userId, source: "ONLINE" };
}

/** Whether this user may see / act on this booking as its customer (admins may see any). */
export async function canSeeBooking(user: { id: string; role: string }, b: { userId: string; source: string }) {
  if (user.role === "ADMIN") return true;
  if (b.userId !== user.id) return false;
  return b.source !== "OFFLINE" || (await phoneVerified(user.id));
}
