import { db } from "./db";

/**
 * WhatsApp (and optional SMS) sending.
 *
 * Messages go by WhatsApp only, unless NOTIFY_CHANNELS says otherwise (e.g. "WHATSAPP,SMS").
 * WhatsApp business messages must use Meta-approved templates; Indian SMS must use DLT-approved ones.
 * Each event below maps to a template you create with your provider:
 *
 *   WhatsApp (Meta Cloud):   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_<EVENT>
 *                            (body parameters {{1}}, {{2}}, ... in the same order as `vars`)
 *                            OTP must be an "Authentication" template (code in {{1}} + copy-code button).
 *   SMS (MSG91 Flow API):    MSG91_AUTH_KEY, MSG91_TEMPLATE_<EVENT>  (variables var1, var2, ...)
 *
 * With no provider configured, messages are only written to the Notification table
 * (visible in Admin → Messages), so nothing breaks during development.
 */

export type NotifyEvent =
  | "OTP"
  | "BOOKING_CONFIRMED"
  | "DRIVER_ASSIGNED"
  | "TRIP_REMINDER"
  | "BOOKING_CANCELLED"
  | "REFUND_DONE"
  | "DRIVER_APPROVED"
  | "DRIVER_REJECTED"
  | "DUTY_ASSIGNED" // to the driver: a trip or full-cab booking was given to them
  | "DUTY_REJECTED" // to the office: a driver turned a duty down
  | "SOS"; // to the office and the driver's emergency contact

/**
 * Every WhatsApp template the system uses, with its body variables in order. Create each one in
 * Meta Business Manager → WhatsApp Manager → Message templates, then put its name in WHATSAPP_TEMPLATE_<EVENT>.
 * Shown on Admin → WhatsApp log so the office can see which ones are still missing.
 */
export const WHATSAPP_TEMPLATES: { event: NotifyEvent; to: string; category: string; vars: string[] }[] = [
  { event: "OTP", to: "Customer / driver", category: "Authentication", vars: ["code"] },
  { event: "BOOKING_CONFIRMED", to: "Customer", category: "Utility", vars: ["booking code", "route", "date & time", "boarding OTP"] },
  { event: "DRIVER_ASSIGNED", to: "Customer", category: "Utility", vars: ["booking code", "driver name", "driver phone", "vehicle number", "tracking link"] },
  { event: "BOOKING_CANCELLED", to: "Customer", category: "Utility", vars: ["booking code", "refund amount"] },
  { event: "REFUND_DONE", to: "Customer", category: "Utility", vars: ["booking code", "refund amount"] },
  { event: "DUTY_ASSIGNED", to: "Driver", category: "Utility", vars: ["route", "date & time", "vehicle number"] },
  { event: "DRIVER_APPROVED", to: "Driver", category: "Utility", vars: ["driver name"] },
  { event: "DRIVER_REJECTED", to: "Driver", category: "Utility", vars: ["driver name", "reason"] },
  { event: "DUTY_REJECTED", to: "Office", category: "Utility", vars: ["message (driver, trip and reason)"] },
  { event: "SOS", to: "Office + emergency contact", category: "Utility", vars: ["message (driver, vehicle, map link)"] },
];

const indian = (phone: string) => (phone.length === 10 ? `91${phone}` : phone.replace(/^\+/, ""));

async function log(channel: string, to: string, event: string, body: string, status: string, error?: string) {
  await db.notification.create({ data: { channel, to, event, body, status, error } });
}

async function sendSms(to: string, event: NotifyEvent, vars: string[], body: string) {
  const key = process.env.MSG91_AUTH_KEY;
  const template = process.env[`MSG91_TEMPLATE_${event}`];
  if (!key || !template) return log("SMS", to, event, body, "LOGGED");
  try {
    const recipient: Record<string, string> = { mobiles: indian(to) };
    vars.forEach((v, i) => (recipient[`var${i + 1}`] = v));
    if (event === "OTP") recipient.otp = vars[0];
    const res = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { authkey: key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ template_id: template, short_url: "0", recipients: [recipient] }),
    });
    await log("SMS", to, event, body, res.ok ? "SENT" : "FAILED", res.ok ? undefined : await res.text());
  } catch (e) {
    await log("SMS", to, event, body, "FAILED", String(e));
  }
}

/** WhatsApp Cloud API is set up for this event (token, phone number id and an approved template name). */
export const whatsappConfigured = (event: NotifyEvent) =>
  !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID && !!process.env[`WHATSAPP_TEMPLATE_${event}`];

/** Sends a WhatsApp template message. Resolves true only if Meta accepted it. */
export async function sendWhatsApp(to: string, event: NotifyEvent, vars: string[], body: string): Promise<boolean> {
  if (!whatsappConfigured(event)) {
    await log("WHATSAPP", to, event, body, "LOGGED");
    return false;
  }
  const components: unknown[] = [{ type: "body", parameters: vars.map((text) => ({ type: "text", text })) }];
  // Authentication templates (OTP) also need the code for their "copy code" button.
  if (event === "OTP") components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: vars[0] }] });
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: indian(to),
        type: "template",
        template: { name: process.env[`WHATSAPP_TEMPLATE_${event}`], language: { code: process.env.WHATSAPP_LANGUAGE || "en" }, components },
      }),
    });
    // Never store the OTP itself in the message log.
    const logged = event === "OTP" ? "Verification code sent" : body;
    await log("WHATSAPP", to, event, logged, res.ok ? "SENT" : "FAILED", res.ok ? undefined : await res.text());
    return res.ok;
  } catch (e) {
    await log("WHATSAPP", to, event, event === "OTP" ? "Verification code" : body, "FAILED", String(e));
    return false;
  }
}

type Channel = "SMS" | "WHATSAPP";
/** NOTIFY_CHANNELS="WHATSAPP" (default) or e.g. "WHATSAPP,SMS". */
const defaultChannels = (): Channel[] => {
  const list = (process.env.NOTIFY_CHANNELS || "WHATSAPP").toUpperCase().split(",").map((c) => c.trim());
  const valid = list.filter((c): c is Channel => c === "SMS" || c === "WHATSAPP");
  return valid.length ? valid : ["WHATSAPP"];
};

/** Sends one event on the configured channels (WhatsApp by default). Never throws: a failed message must not break a booking. */
export async function notify(to: string, event: NotifyEvent, vars: string[], body: string, channels: Channel[] = defaultChannels()) {
  try {
    await Promise.all(channels.map((c) => (c === "SMS" ? sendSms(to, event, vars, body) : sendWhatsApp(to, event, vars, body))));
  } catch (e) {
    console.error("notify failed", e);
  }
}

/** The office mobile number for staff alerts (driver rejected a duty, SOS). */
export function officePhone() {
  const digits = (process.env.ADMIN_PHONE || process.env.NEXT_PUBLIC_SUPPORT_PHONE || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export const smsConfigured = () => !!process.env.MSG91_AUTH_KEY && !!process.env.MSG91_TEMPLATE_OTP;
