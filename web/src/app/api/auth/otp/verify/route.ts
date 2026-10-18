import { z } from "zod";
import { db } from "@/lib/db";
import { handle, HttpError, ok } from "@/lib/http";
import { verifyOtp } from "@/lib/otp";
import { phoneSchema } from "@/lib/schemas";
import { assertNewAccount, optionalEmail, otpChannel, otpCode, signupTarget } from "@/lib/signup";
import { sessionResponse } from "@/lib/session";

const schema = z.object({
  phone: phoneSchema,
  otp: otpCode,
  name: z.string().trim().min(2, "Enter your full name").optional(),
  email: optionalEmail,
  channel: otpChannel,
});

// POST /api/auth/otp/verify { phone, otp, name?, email?, channel? } -> { token, user } | { needsName: true }
// channel "EMAIL" verifies the OTP sent to `email` and creates a new account with that phone and email.
export const POST = handle(async (req: Request) => {
  const { phone, otp, name, email, channel } = schema.parse(await req.json());
  if (channel === "EMAIL") await assertNewAccount(phone, email);
  let user = channel === "PHONE" ? await db.user.findUnique({ where: { phone } }) : null;
  // Admin accounts log in with their password only (an OTP shown in test mode must never open the admin panel).
  if (user?.role === "ADMIN") throw new HttpError(403, "Please log in with your password.");
  // New customers must give their name; ask before using up the OTP.
  if (!user && !name) return ok({ needsName: true });
  const { delivered } = await verifyOtp(signupTarget(channel, phone, email), otp);
  const phoneVerified = channel === "PHONE" && delivered;
  user ??= await db.user.create({ data: { phone, name: name!, email: channel === "EMAIL" ? email : undefined, phoneVerified } });
  if (phoneVerified && !user.phoneVerified) user = await db.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
  return sessionResponse(user);
});
