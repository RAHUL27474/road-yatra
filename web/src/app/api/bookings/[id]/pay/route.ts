import { handle, ok } from "@/lib/http";
import { assertCanPay } from "@/lib/pay-auth";
import { startPayment } from "@/lib/payment";

// POST /api/bookings/:id/pay { payToken? } -> { mode: "DEMO" } or Razorpay order details
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await assertCanPay(req, id, body.payToken);
  return ok(await startPayment(id));
});
