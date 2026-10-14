import { z } from "zod";
import { db } from "./db";
import { HttpError } from "./http";
import type { OtpChannel } from "./otp";
import { phoneSchema } from "./schemas";

/** An optional email: "" counts as not given. */
export const optionalEmail = z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("").transform(() => undefined));
export const otpChannel = z.enum(["PHONE", "EMAIL"]).default("PHONE");
export const otpCode = z.string({ required_error: "Please verify your mobile number or email with an OTP. Update the app if you don't see this step." }).trim().regex(/^\d{6}$/, "Enter the 6-digit OTP");

/** Password sign-up. `channel` picks where the verification OTP goes: the mobile number or the email. */
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: optionalEmail,
  phone: phoneSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
  channel: otpChannel,
});

/** Where a sign-up OTP goes: the mobile number, or the email for EMAIL. */
export function signupTarget(channel: OtpChannel, phone: string, email?: string) {
  if (channel === "PHONE") return phone;
  if (!email) throw new HttpError(400, "Enter your email to get the OTP by email.");
  return email;
}

/** Throws 409 when the mobile number or email already belongs to an account. */
export async function assertNewAccount(phone: string, email?: string) {
  const exists = await db.user.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] }, select: { id: true } });
  if (exists) throw new HttpError(409, "An account with this mobile number or email already exists. Please log in.");
}
