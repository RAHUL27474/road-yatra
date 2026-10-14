import { z } from "zod";
import { db } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import { requestOtp } from "@/lib/otp";
import { phoneSchema } from "@/lib/schemas";
import { assertNewAccount, optionalEmail, otpChannel, signupTarget } from "@/lib/signup";

const schema = z.object({ phone: phoneSchema, email: optionalEmail, channel: otpChannel });

// POST /api/auth/otp/request { phone, email?, channel? } -> { sent, isNewUser, devOtp? }
// channel "EMAIL" sends the OTP to `email` and is only for new accounts: existing users log in with their mobile OTP or password.
export const POST = handle(async (req: Request) => {
  const { phone, email, channel } = schema.parse(await req.json());
  if (channel === "EMAIL") await assertNewAccount(phone, email);
  const { devOtp } = await requestOtp(signupTarget(channel, phone, email), channel);
  const isNewUser = channel === "EMAIL" || !(await db.user.findUnique({ where: { phone }, select: { id: true } }));
  return ok({ sent: true, isNewUser, devOtp });
});
