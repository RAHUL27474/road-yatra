import { handle, ok } from "@/lib/http";
import { handleRazorpayWebhook } from "@/lib/payment";

// POST /api/payments/razorpay-webhook  (set in Razorpay Dashboard → Webhooks: payment.captured, order.paid)
export const POST = handle(async (req: Request) => {
  return ok(await handleRazorpayWebhook(await req.text(), req.headers.get("x-razorpay-signature")));
});
