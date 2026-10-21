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
    travelPolicy: s.travelPolicy,
    returnDiscountPercent: s.returnDiscountPercent,
    freeChangeHours: s.freeChangeHours,
    // Advance only makes sense with real online payments.
    advancePerSeat: onlinePaymentsAvailable() ? s.advancePerSeat : 0,
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_SUPPORT_PHONE || "",
    // Pay by UPI at boarding (straight to the office account; the driver marks it received).
    upiId: s.upiId,
    upiName: s.upiName,
    // Customer app update prompt (Android versionCodes). Raise "latest" after each Play release.
    appUpdate: { latest: Number(process.env.CUSTOMER_APP_LATEST_VERSION) || 0, min: Number(process.env.CUSTOMER_APP_MIN_VERSION) || 0 },
  });
}
