import { db } from "./db";

/**
 * Email sending through Resend (https://resend.com): RESEND_API_KEY and EMAIL_FROM,
 * e.g. EMAIL_FROM="Jai Shree Shyam Travels <noreply@your-domain>" (the domain must be verified in Resend).
 *
 * With no provider configured, emails are only written to the Notification table
 * (visible in Admin → Messages), like SMS.
 */

export const emailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

async function log(to: string, event: string, body: string, status: string, error?: string) {
  await db.notification.create({ data: { channel: "EMAIL", to, event, body, status, error } });
}

/** Sends one plain-text email. Never throws: a failed message is logged instead. */
export async function sendEmail(to: string, event: string, subject: string, body: string) {
  try {
    if (!emailConfigured()) return await log(to, event, body, "LOGGED");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text: body }),
    });
    await log(to, event, body, res.ok ? "SENT" : "FAILED", res.ok ? undefined : await res.text());
  } catch (e) {
    console.error("sendEmail failed", e);
  }
}
