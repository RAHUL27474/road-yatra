import { ok } from "@/lib/http";
import { isDemoPayments } from "@/lib/payment";
import { onlinePaymentsAvailable } from "@/lib/payment-mode";
import { GST_RATE, HOLD_MINUTES } from "@/lib/booking";
import { getSettings } from "@/lib/settings";
import { otpAvailable } from "@/lib/otp";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  return ok({
    brandName: process.env.NEXT_PUBLIC_BRAND_NAME || "Jai Shree Shyam Tour & Travels",
    supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "",
    demoPayments: isDemoPayments(),
    onlinePayments: onlinePaymentsAvailable(),
    allowCash: s.allowCash,
    otpLogin: otpAvailable("PHONE"),
    emailOtp: otpAvailable("EMAIL"),
    gstRate: GST_RATE,
    holdMinutes: HOLD_MINUTES,
    cancellationSlabs: s.cancellationSlabs,
  });
}
