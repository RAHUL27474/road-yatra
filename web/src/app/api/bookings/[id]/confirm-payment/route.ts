import { handle, ok } from "@/lib/http";
import { assertCanPay } from "@/lib/pay-auth";
import { confirmPayment } from "@/lib/payment";

// POST /api/bookings/:id/confirm-payment { payToken?, razorpay_order_id?, razorpay_payment_id?, razorpay_signature? }
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await assertCanPay(req, id, body.payToken);
  const booking = await confirmPayment(id, body);
  return ok({ status: booking.status, code: booking.code });
});
