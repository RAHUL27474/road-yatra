import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { handle } from "@/lib/http";
import { verifyOtp } from "@/lib/otp";
import { assertNewAccount, otpCode, registerSchema, signupTarget } from "@/lib/signup";
import { sessionResponse } from "@/lib/session";

// POST /api/auth/register { name, phone, email?, password, channel, otp } -> { token, user }
// Step 2 of sign-up: the OTP sent by POST /api/auth/register/otp to the mobile number or email.
export const POST = handle(async (req: Request) => {
  const data = registerSchema.extend({ otp: otpCode }).parse(await req.json());
  await assertNewAccount(data.phone, data.email);
  await verifyOtp(signupTarget(data.channel, data.phone, data.email), data.otp);
  const user = await db.user.create({
    data: { name: data.name, email: data.email, phone: data.phone, passwordHash: await hashPassword(data.password) },
  });
  return sessionResponse(user, 201);
});
