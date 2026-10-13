import crypto from "node:crypto";
import { db } from "./db";
import { jwtSecret } from "./secret";
import { HttpError } from "./http";
import { notify, smsConfigured } from "./notify";

const OTP_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

const hash = (phone: string, code: string) =>
  crypto.createHmac("sha256", jwtSecret()).update(`${phone}:${code}`).digest("hex");

/**
 * OTP_DEV_MODE=true returns the code in the API response when no SMS provider is set up,
 * so you can test without sending SMS. Turn it off before going live.
 */
const devMode = () => process.env.OTP_DEV_MODE === "true";

export async function requestOtp(phone: string) {
  const recent = await db.otpCode.count({ where: { phone, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (recent >= MAX_PER_HOUR) throw new HttpError(429, "Too many OTP requests. Please try again in an hour.");
  if (!smsConfigured() && !devMode()) throw new HttpError(503, "SMS login is not set up yet. Please log in with your password.");

  const code = String(crypto.randomInt(100000, 1000000));
  await db.otpCode.create({ data: { phone, codeHash: hash(phone, code), expiresAt: new Date(Date.now() + OTP_MINUTES * 60_000) } });
  await notify(phone, "OTP", [code], `${code} is your login OTP. Valid for ${OTP_MINUTES} minutes. Do not share it with anyone.`, ["SMS"]);
  return { devOtp: !smsConfigured() && devMode() ? code : undefined };
}

export async function verifyOtp(phone: string, code: string) {
  const otp = await db.otpCode.findFirst({ where: { phone, used: false }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt < new Date()) throw new HttpError(400, "OTP expired. Please request a new one.");
  if (otp.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Too many wrong attempts. Please request a new OTP.");
  const a = Buffer.from(otp.codeHash);
  const b = Buffer.from(hash(phone, code));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, "Incorrect OTP.");
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });
}
