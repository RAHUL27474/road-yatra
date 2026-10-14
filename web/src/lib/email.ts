import nodemailer from "nodemailer";
import { db } from "./db";

/**
 * Email sending over SMTP (Nodemailer), so any provider works, including free ones:
 *   Gmail (app password):  SMTP_HOST=smtp.gmail.com     SMTP_PORT=465  ~500 emails/day
 *   Brevo:                 SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587  300 emails/day free
 *   Mailjet:               SMTP_HOST=in-v3.mailjet.com   SMTP_PORT=587  200 emails/day free
 * plus SMTP_USER, SMTP_PASS and EMAIL_FROM (e.g. "Jai Shree Shyam Travels <you@gmail.com>").
 *
 * With no SMTP configured, emails are only written to the Notification table
 * (visible in Admin → Messages), like SMS.
 */

export const emailConfigured = () => !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;

let transport: nodemailer.Transporter | null = null;
function getTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = TLS from the start; 587 upgrades with STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

async function log(to: string, event: string, body: string, status: string, error?: string) {
  await db.notification.create({ data: { channel: "EMAIL", to, event, body, status, error } });
}

/** Sends one plain-text email. Never throws: a failed message is logged and `false` returned. */
export async function sendEmail(to: string, event: string, subject: string, body: string) {
  try {
    if (!emailConfigured()) {
      await log(to, event, body, "LOGGED");
      return true;
    }
    try {
      await getTransport().sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, text: body });
      await log(to, event, body, "SENT");
      return true;
    } catch (e) {
      await log(to, event, body, "FAILED", String(e));
      return false;
    }
  } catch (e) {
    console.error("sendEmail failed", e);
    return false;
  }
}
