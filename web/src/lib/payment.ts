import crypto from "node:crypto";
import type { Booking } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./http";
import { expireStaleHolds, onBookingConfirmed } from "./booking";
import { onlinePaymentsAvailable } from "./payment-mode";
import { getSettings } from "./settings";

const keyId = () => process.env.RAZORPAY_KEY_ID || "";
const keySecret = () => process.env.RAZORPAY_KEY_SECRET || "";

/** Demo mode: no Razorpay keys configured, so payments are simulated. */
export const isDemoPayments = () => !keyId() || !keySecret();

async function payableBooking(bookingId: string) {
  if (!onlinePaymentsAvailable()) throw new HttpError(503, "Online payment is not available yet. Please book with cash to driver, or call us.");
  await expireStaleHolds();
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, "Booking not found.");
  if (booking.status === "CONFIRMED") throw new HttpError(400, "This booking is already paid.");
  if (booking.status !== "PENDING") throw new HttpError(400, "This booking has expired or was cancelled. Please book again.");
  return booking;
}

/** What is paid online now: the whole fare, or for an ADVANCE booking the advance per seat (rest is cash to the driver). */
export async function amountToCharge(b: Pick<Booking, "paymentMode" | "passengers" | "totalAmount">) {
  if (b.paymentMode !== "ADVANCE") return b.totalAmount;
  const perSeat = (await getSettings()).advancePerSeat;
  return Math.min(b.totalAmount, Math.max(1, Math.round(perSeat * b.passengers)));
}

export async function startPayment(bookingId: string) {
  const booking = await payableBooking(bookingId);
  const amount = await amountToCharge(booking);
  if (isDemoPayments()) return { mode: "DEMO" as const, amount };

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${keyId()}:${keySecret()}`).toString("base64"),
    },
    body: JSON.stringify({ amount: Math.round(amount * 100), currency: "INR", receipt: booking.code, notes: { bookingId: booking.id } }),
  });
  if (!res.ok) {
    console.error("Razorpay order failed", res.status, await res.text());
    throw new HttpError(502, "Could not start payment. Please try again.");
  }
  const order = (await res.json()) as { id: string; amount: number };
  await db.booking.update({ where: { id: booking.id }, data: { razorpayOrderId: order.id } });
  return { mode: "RAZORPAY" as const, keyId: keyId(), orderId: order.id, amountPaise: order.amount, code: booking.code };
}

/**
 * Flips PENDING → CONFIRMED exactly once, even if the browser callback and the webhook race.
 * An ADVANCE booking becomes PARTIAL (the driver collects the rest); everything else becomes PAID.
 * Returns false if it was already confirmed (or expired) by someone else.
 */
async function markPaid(booking: Booking, paymentMode: string, paymentId: string) {
  const amount = await amountToCharge(booking);
  const partial = booking.paymentMode === "ADVANCE" && amount < booking.totalAmount;
  const { count } = await db.booking.updateMany({
    where: { id: booking.id, status: "PENDING" },
    data: {
      status: "CONFIRMED",
      paymentStatus: partial ? "PARTIAL" : "PAID",
      paymentMode: booking.paymentMode === "ADVANCE" ? "ADVANCE" : paymentMode,
      paymentId,
      amountPaid: amount,
      paidAt: new Date(),
    },
  });
  if (count) await onBookingConfirmed(booking.id);
  return count > 0;
}

export async function confirmPayment(
  bookingId: string,
  p: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string },
) {
  const booking = await payableBooking(bookingId);

  if (isDemoPayments()) {
    if (!(await markPaid(booking, "DEMO", `demo_${Date.now()}`))) throw new HttpError(400, "This booking is already paid or has expired.");
    return db.booking.findUniqueOrThrow({ where: { id: booking.id } });
  }

  if (!p.razorpay_order_id || !p.razorpay_payment_id || !p.razorpay_signature) throw new HttpError(400, "Missing payment details.");
  if (p.razorpay_order_id !== booking.razorpayOrderId) throw new HttpError(400, "Payment does not match this booking.");
  const expected = crypto.createHmac("sha256", keySecret()).update(`${p.razorpay_order_id}|${p.razorpay_payment_id}`).digest("hex");
  if (!safeEqual(expected, p.razorpay_signature)) throw new HttpError(400, "Payment verification failed.");

  await markPaid(booking, "RAZORPAY", p.razorpay_payment_id);
  return db.booking.findUniqueOrThrow({ where: { id: booking.id } });
}

const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Razorpay webhook (payment.captured / order.paid). Confirms the booking even when the customer closed the
 * payment page before it returned — otherwise they'd be charged and the hold would expire.
 * Set the webhook URL to https://<site>/api/payments/razorpay-webhook and RAZORPAY_WEBHOOK_SECRET to its secret.
 */
export async function handleRazorpayWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, "Webhook secret not set.");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!signature || !safeEqual(expected, signature)) throw new HttpError(400, "Bad signature.");

  const event = JSON.parse(rawBody) as {
    event: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } }; order?: { entity?: { id?: string } } };
  };
  if (event.event !== "payment.captured" && event.event !== "order.paid") return { ignored: event.event };
  const orderId = event.payload?.payment?.entity?.order_id ?? event.payload?.order?.entity?.id;
  const paymentId = event.payload?.payment?.entity?.id ?? `order_${orderId}`;
  if (!orderId) return { ignored: "no order id" };
  const booking = await db.booking.findFirst({ where: { razorpayOrderId: orderId } });
  if (!booking) return { ignored: "unknown order" };
  if (booking.status === "PENDING") await markPaid(booking, "RAZORPAY", paymentId);
  else if (booking.status !== "CONFIRMED") {
    // Paid after the hold expired: keep a trace for the office to refund or re-book.
    await db.booking.update({ where: { id: booking.id }, data: { adminNote: `Paid online (${paymentId}) after the booking ${booking.status.toLowerCase()} — refund or re-book.` } });
  }
  return { ok: true };
}
