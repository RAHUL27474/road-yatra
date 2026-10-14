import { HttpError } from "./http";

/**
 * SMS OTPs through Message Central Verify Now (https://www.messagecentral.com), which sends from its own
 * DLT-approved template, so no DLT registration of your own is needed.
 *   MESSAGE_CENTRAL_CUSTOMER_ID  your customer ID (Message Central console)
 *   MESSAGE_CENTRAL_PASSWORD     your account password (sent Base64-encoded as the API key)
 *
 * Message Central creates and checks the code itself: send() returns a verificationId, validate() checks the code against it.
 */

const BASE = "https://cpaas.messagecentral.com";
const OTP_LENGTH = 6;

export const messageCentralConfigured = () => !!process.env.MESSAGE_CENTRAL_CUSTOMER_ID && !!process.env.MESSAGE_CENTRAL_PASSWORD;

const unavailable = () => new HttpError(502, "Could not send the SMS right now. Please try again in a minute.");

// The auth token is reused until Message Central rejects it.
let token: string | null = null;

async function getToken(fresh = false) {
  if (token && !fresh) return token;
  const params = new URLSearchParams({
    customerId: process.env.MESSAGE_CENTRAL_CUSTOMER_ID!,
    key: Buffer.from(process.env.MESSAGE_CENTRAL_PASSWORD!).toString("base64"),
    scope: "NEW",
    country: "91",
  });
  const res = await fetch(`${BASE}/auth/v1/authentication/token?${params}`, { headers: { accept: "*/*" } });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.token) {
    console.error("Message Central token failed", res.status, data);
    throw unavailable();
  }
  token = data.token as string;
  return token;
}

/** Calls the API with the auth token, getting a new token once if the old one was rejected. */
async function call(method: "GET" | "POST", path: string, params: Record<string, string>) {
  for (const fresh of [false, true]) {
    const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, { method, headers: { authToken: await getToken(fresh), accept: "*/*" } });
    if (res.status === 401 && !fresh) continue;
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  throw unavailable();
}

/** Sends an OTP by SMS to a 10-digit Indian mobile number. Returns the verificationId needed to check it. */
export async function sendOtp(phone: string) {
  const { status, data } = await call("POST", "/verification/v3/send", { countryCode: "91", flowType: "SMS", mobileNumber: phone, otpLength: String(OTP_LENGTH) });
  const id = data?.data?.verificationId;
  if (status !== 200 || !id) {
    console.error("Message Central send failed", status, data);
    if (data?.responseCode === 800 || data?.data?.responseCode === "800") throw new HttpError(429, "Too many OTP requests. Please try again later.");
    throw unavailable();
  }
  return String(id);
}

/** Checks a code. "OK" when correct, "WRONG" for an incorrect code, "EXPIRED" when the code can no longer be used. */
export async function validateOtp(verificationId: string, code: string): Promise<"OK" | "WRONG" | "EXPIRED"> {
  const { status, data } = await call("GET", "/verification/v3/validateOtp", { verificationId, code });
  const rc = Number(data?.responseCode ?? data?.data?.responseCode);
  if (status === 200 && data?.data?.verificationStatus === "VERIFICATION_COMPLETED") return "OK";
  if (rc === 702) return "WRONG";
  if (rc === 705 || rc === 703 || rc === 505 || rc === 800) return "EXPIRED";
  console.error("Message Central validate failed", status, data);
  throw unavailable();
}
