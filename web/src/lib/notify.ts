import { db } from "./db";

/**
 * SMS and WhatsApp sending.
 *
 * Indian SMS must use DLT-approved templates, and WhatsApp business messages must use
 * Meta-approved templates. Each event below maps to a template you create with your provider:
 *
 *   SMS (MSG91 Flow API):    MSG91_AUTH_KEY, MSG91_TEMPLATE_<EVENT>  (variables var1, var2, ...)
 *   WhatsApp (Meta Cloud):   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_<EVENT>
 *                            (body parameters {{1}}, {{2}}, ... in the same order)
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

async function sendWhatsApp(to: string, event: NotifyEvent, vars: string[], body: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env[`WHATSAPP_TEMPLATE_${event}`];
  if (!token || !phoneId || !template) return log("WHATSAPP", to, event, body, "LOGGED");
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: indian(to),
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_LANGUAGE || "en" },
          components: [{ type: "body", parameters: vars.map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    await log("WHATSAPP", to, event, body, res.ok ? "SENT" : "FAILED", res.ok ? undefined : await res.text());
  } catch (e) {
    await log("WHATSAPP", to, event, body, "FAILED", String(e));
  }
}

/** Sends one event by SMS and WhatsApp. Never throws: a failed message must not break a booking. */
export async function notify(to: string, event: NotifyEvent, vars: string[], body: string, channels: ("SMS" | "WHATSAPP")[] = ["SMS", "WHATSAPP"]) {
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
