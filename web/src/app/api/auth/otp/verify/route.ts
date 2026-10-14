import { z } from "zod";
import { db } from "@/lib/db";
import { handle, ok } from "@/lib/http";
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
  // New customers must give their name; ask before using up the OTP.
  if (!user && !name) return ok({ needsName: true });
  await verifyOtp(signupTarget(channel, phone, email), otp);
  user ??= await db.user.create({ data: { phone, name: name!, email: channel === "EMAIL" ? email : undefined } });
  return sessionResponse(user);
});
