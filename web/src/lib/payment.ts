import crypto from "node:crypto";
import { db } from "./db";
import { HttpError } from "./http";
import { expireStaleHolds, onBookingConfirmed } from "./booking";

const keyId = () => process.env.RAZORPAY_KEY_ID || "";
const keySecret = () => process.env.RAZORPAY_KEY_SECRET || "";

/** Demo mode: no Razorpay keys configured, so payments are simulated. */
export const isDemoPayments = () => !keyId() || !keySecret();

async function payableBooking(bookingId: string) {
  await expireStaleHolds();
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, "Booking not found.");
  if (booking.status === "CONFIRMED") throw new HttpError(400, "This booking is already paid.");
  if (booking.status !== "PENDING") throw new HttpError(400, "This booking has expired or was cancelled. Please book again.");
  return booking;
}

export async function startPayment(bookingId: string) {
  const booking = await payableBooking(bookingId);
  if (isDemoPayments()) return { mode: "DEMO" as const, amount: booking.totalAmount };

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${keyId()}:${keySecret()}`).toString("base64"),
    },
    body: JSON.stringify({ amount: Math.round(booking.totalAmount * 100), currency: "INR", receipt: booking.code }),
  });
  if (!res.ok) {
    console.error("Razorpay order failed", res.status, await res.text());
    throw new HttpError(502, "Could not start payment. Please try again.");
  }
  const order = (await res.json()) as { id: string; amount: number };
  await db.booking.update({ where: { id: booking.id }, data: { razorpayOrderId: order.id } });
  return { mode: "RAZORPAY" as const, keyId: keyId(), orderId: order.id, amountPaise: order.amount, code: booking.code };
}

/** Flips PENDING → CONFIRMED exactly once, even if two confirmations race. */
async function markPaid(id: string, data: { status: string; paymentStatus: string; paymentMode: string; paymentId: string }) {
  const { count } = await db.booking.updateMany({ where: { id, status: "PENDING" }, data: { ...data, paidAt: new Date() } });
  if (count === 0) throw new HttpError(400, "This booking is already paid or has expired.");
}

export async function confirmPayment(
  bookingId: string,
  p: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string },
) {
  const booking = await payableBooking(bookingId);

  if (isDemoPayments()) {
    await markPaid(booking.id, { status: "CONFIRMED", paymentStatus: "PAID", paymentMode: "DEMO", paymentId: `demo_${Date.now()}` });
    await onBookingConfirmed(booking.id);
    return db.booking.findUniqueOrThrow({ where: { id: booking.id } });
  }

  if (!p.razorpay_order_id || !p.razorpay_payment_id || !p.razorpay_signature) throw new HttpError(400, "Missing payment details.");
  if (p.razorpay_order_id !== booking.razorpayOrderId) throw new HttpError(400, "Payment does not match this booking.");
  const expected = crypto.createHmac("sha256", keySecret()).update(`${p.razorpay_order_id}|${p.razorpay_payment_id}`).digest("hex");
  const valid =
    expected.length === p.razorpay_signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(p.razorpay_signature));
  if (!valid) throw new HttpError(400, "Payment verification failed.");

  await markPaid(booking.id, { status: "CONFIRMED", paymentStatus: "PAID", paymentMode: "RAZORPAY", paymentId: p.razorpay_payment_id });
  await onBookingConfirmed(booking.id);
  return db.booking.findUniqueOrThrow({ where: { id: booking.id } });
}
