import { handle, ok } from "@/lib/http";
import { requestOtp } from "@/lib/otp";
import { assertNewAccount, registerSchema, signupTarget } from "@/lib/signup";

// POST /api/auth/register/otp { name, phone, email?, password, channel: "PHONE" | "EMAIL" } -> { sent, channel, sentTo, devOtp? }
// Step 1 of sign-up: checks the form and sends the verification OTP. Step 2 is POST /api/auth/register with the OTP.
export const POST = handle(async (req: Request) => {
  const data = registerSchema.parse(await req.json());
  await assertNewAccount(data.phone, data.email);
  const sentTo = signupTarget(data.channel, data.phone, data.email);
  const { devOtp } = await requestOtp(sentTo, data.channel);
  return ok({ sent: true, channel: data.channel, sentTo, devOtp });
});
