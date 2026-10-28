import crypto from "node:crypto";
import { db } from "./db";
import { jwtSecret } from "./secret";
import { HttpError } from "./http";
import { notify, sendWhatsApp, smsConfigured, whatsappConfigured } from "./notify";
import { emailConfigured, sendEmail } from "./email";
import * as messageCentral from "./messagecentral";

const OTP_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;
/** OtpCode.codeHash prefix for codes created and checked by Message Central (the rest is its verificationId). */
const MC = "mc:";

/** Where an OTP is sent: PHONE by WhatsApp (or SMS as a fallback provider), EMAIL by email. The target is the phone number or the (lowercase) email. */
export type OtpChannel = "PHONE" | "EMAIL";

const hash = (target: string, code: string) =>
  crypto.createHmac("sha256", jwtSecret()).update(`${target}:${code}`).digest("hex");

/**
 * OTP_DEV_MODE=true returns the code in the API response when no SMS/email provider is set up,
 * so you can test without sending messages. Turn it off before going live.
 */
const devMode = () => process.env.OTP_DEV_MODE === "true";
const configured = (channel: OtpChannel) =>
  channel === "EMAIL" ? emailConfigured() : whatsappConfigured("OTP") || messageCentral.messageCentralConfigured() || smsConfigured();

/** Whether OTPs can be sent on this channel (a provider is set up, or test mode is on). */
export const otpAvailable = (channel: OtpChannel) => configured(channel) || devMode();

export async function requestOtp(target: string, channel: OtpChannel = "PHONE") {
  const recent = await db.otpCode.count({ where: { phone: target, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (recent >= MAX_PER_HOUR) throw new HttpError(429, "Too many OTP requests. Please try again in an hour.");
  if (!otpAvailable(channel)) {
    throw new HttpError(503, channel === "EMAIL" ? "Email OTP is not set up yet. Please verify with your mobile number." : "Mobile OTP is not set up yet. Please log in with your password.");
  }
  const expiresAt = new Date(Date.now() + OTP_MINUTES * 60_000);

  // Message Central makes the code and sends it; we keep its verificationId to check the code later.
  // (Only when WhatsApp OTP isn't set up: WhatsApp is the main channel.)
  if (channel === "PHONE" && !whatsappConfigured("OTP") && messageCentral.messageCentralConfigured()) {
    const verificationId = await messageCentral.sendOtp(target);
    await db.otpCode.create({ data: { phone: target, codeHash: MC + verificationId, expiresAt, delivered: true } });
    return { devOtp: undefined };
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const text = `${code} is your verification OTP. Valid for ${OTP_MINUTES} minutes. Do not share it with anyone.`;
  if (channel === "EMAIL") {
    if (!(await sendEmail(target, "OTP", `Your OTP is ${code}`, text))) {
      throw new HttpError(502, "Could not send the email right now. Please check the address or verify with your mobile number.");
    }
  } else if (whatsappConfigured("OTP")) {
    if (!(await sendWhatsApp(target, "OTP", [code], text))) {
      throw new HttpError(502, "Could not send the OTP on WhatsApp right now. Check that this number uses WhatsApp, or try again in a minute.");
    }
  } else await notify(target, "OTP", [code], text, ["SMS"]);
  await db.otpCode.create({ data: { phone: target, codeHash: hash(target, code), expiresAt, delivered: configured(channel) } });
  return { devOtp: !configured(channel) && devMode() ? code : undefined };
}

/**
 * Checks the code. Resolves `delivered`: true when the code really reached the person (not test mode).
 * `keep`: check without using the code up (e.g. before asking a new user's name). Message Central codes can only be
 * checked once, so those are not checked when kept; the later full check catches a wrong one.
 */
export async function verifyOtp(target: string, code: string, { keep = false } = {}): Promise<{ delivered: boolean }> {
  const otp = await db.otpCode.findFirst({ where: { phone: target, used: false }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt < new Date()) throw new HttpError(400, "OTP expired. Please request a new one.");
  if (keep && otp.codeHash.startsWith(MC)) return { delivered: otp.delivered };
  const claim = await db.otpCode.updateMany({ where: { id: otp.id, attempts: { lt: MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
  if (!claim.count) throw new HttpError(429, "Too many wrong attempts. Please request a new OTP.");

  let correct: boolean;
  if (otp.codeHash.startsWith(MC)) {
    const result = await messageCentral.validateOtp(otp.codeHash.slice(MC.length), code);
    if (result === "EXPIRED") {
      await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });
      throw new HttpError(400, "OTP expired. Please request a new one.");
    }
    correct = result === "OK";
  } else {
    const a = Buffer.from(otp.codeHash);
    const b = Buffer.from(hash(target, code));
    correct = a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  if (!correct) throw new HttpError(400, "Incorrect OTP."); // the attempt was already counted above
  if (!keep) await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });
  return { delivered: otp.delivered };
}
