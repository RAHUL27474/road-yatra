import crypto from "node:crypto";
import { db } from "./db";
import { jwtSecret } from "./secret";
import { HttpError } from "./http";
import { notify, smsConfigured } from "./notify";
import { emailConfigured, sendEmail } from "./email";

const OTP_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

/** Where an OTP is sent: PHONE by SMS, EMAIL by email. The target is the phone number or the (lowercase) email. */
export type OtpChannel = "PHONE" | "EMAIL";

const hash = (target: string, code: string) =>
  crypto.createHmac("sha256", jwtSecret()).update(`${target}:${code}`).digest("hex");

/**
 * OTP_DEV_MODE=true returns the code in the API response when no SMS/email provider is set up,
 * so you can test without sending messages. Turn it off before going live.
 */
const devMode = () => process.env.OTP_DEV_MODE === "true";
const configured = (channel: OtpChannel) => (channel === "EMAIL" ? emailConfigured() : smsConfigured());

/** Whether OTPs can be sent on this channel (a provider is set up, or test mode is on). */
export const otpAvailable = (channel: OtpChannel) => configured(channel) || devMode();

export async function requestOtp(target: string, channel: OtpChannel = "PHONE") {
  const recent = await db.otpCode.count({ where: { phone: target, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (recent >= MAX_PER_HOUR) throw new HttpError(429, "Too many OTP requests. Please try again in an hour.");
  if (!otpAvailable(channel)) {
    throw new HttpError(503, channel === "EMAIL" ? "Email OTP is not set up yet. Please verify with your mobile number." : "SMS login is not set up yet. Please log in with your password.");
  }

  const code = String(crypto.randomInt(100000, 1000000));
  await db.otpCode.create({ data: { phone: target, codeHash: hash(target, code), expiresAt: new Date(Date.now() + OTP_MINUTES * 60_000) } });
  const text = `${code} is your verification OTP. Valid for ${OTP_MINUTES} minutes. Do not share it with anyone.`;
  if (channel === "EMAIL") await sendEmail(target, "OTP", `Your OTP is ${code}`, text);
  else await notify(target, "OTP", [code], text, ["SMS"]);
  return { devOtp: !configured(channel) && devMode() ? code : undefined };
}

export async function verifyOtp(target: string, code: string) {
  const otp = await db.otpCode.findFirst({ where: { phone: target, used: false }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt < new Date()) throw new HttpError(400, "OTP expired. Please request a new one.");
  if (otp.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Too many wrong attempts. Please request a new OTP.");
  const a = Buffer.from(otp.codeHash);
  const b = Buffer.from(hash(target, code));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, "Incorrect OTP.");
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });
}
