import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { handle, HttpError } from "@/lib/http";
import { verifyOtp } from "@/lib/otp";
import { assertNewAccount, otpCode, registerSchema, signupOtpRequired, signupTarget } from "@/lib/signup";
import { sessionResponse } from "@/lib/session";

// POST /api/auth/register { name, phone, email?, password, channel, otp } -> { token, user }
// Step 2 of sign-up: the OTP sent by POST /api/auth/register/otp to the mobile number or email.
// While no SMS/email provider is set up (see signupOtpRequired), `otp` is not needed.
export const POST = handle(async (req: Request) => {
  const data = registerSchema.extend({ otp: otpCode.optional() }).parse(await req.json());
  await assertNewAccount(data.phone, data.email);
  let phoneVerified = false;
  if (signupOtpRequired()) {
    if (!data.otp) throw new HttpError(400, "Please verify your mobile number or email with an OTP. Update the app if you don't see this step.");
    const { delivered } = await verifyOtp(signupTarget(data.channel, data.phone, data.email), data.otp);
    phoneVerified = data.channel === "PHONE" && delivered;
  }
  const user = await db.user.create({
    data: { name: data.name, email: data.email, phone: data.phone, passwordHash: await hashPassword(data.password), phoneVerified },
  });
  return sessionResponse(user, 201);
});
