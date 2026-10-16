import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Hourglass, Lock } from "lucide-react";
import { loadBookingForPage } from "@/lib/booking-access";
import { expireStaleHolds, serializeBooking } from "@/lib/booking";
import { amountToCharge, isDemoPayments } from "@/lib/payment";
import BookingSummary from "@/components/BookingSummary";
import PayPanel from "./PayPanel";

export const metadata = { title: "Payment" };

export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  await expireStaleHolds();
  const access = await loadBookingForPage(id, t);
  if (!access) notFound();
  const b = serializeBooking(access.booking);
  const confirmUrl = `/booking/${b.code}${t ? `?t=${encodeURIComponent(t)}` : ""}`;
  if (b.status === "CONFIRMED") redirect(confirmUrl);

  return (
    <div className="container-x max-w-5xl py-8">
      <div className="mb-5 flex items-center gap-2">
        <Lock className="h-5 w-5 text-green-600" aria-hidden />
        <h1 className="page-title">Secure checkout</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card p-5 sm:p-6">
          <h2 className="mb-3 text-lg font-bold text-ink">Review your booking</h2>
          <BookingSummary b={b} />
        </div>
        <div className="card h-fit p-5 sm:p-6 lg:sticky lg:top-24">
          {b.status === "PENDING" ? (
            <PayPanel
              bookingId={b.id}
              payToken={t}
              amount={await amountToCharge(access.booking)}
              expiresAt={b.holdExpiresAt!.toISOString()}
              demo={isDemoPayments()}
              confirmUrl={confirmUrl}
              prefill={{ name: b.passengerName, contact: b.passengerPhone }}
            />
          ) : (
            <div className="py-4 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                <Hourglass className="h-7 w-7" aria-hidden />
              </span>
              <p className="mt-3 font-bold text-ink">This booking has {b.status === "CANCELLED" ? "been cancelled" : "expired"}.</p>
              <p className="text-sm text-slate-500">The seats or vehicle were released because payment was not completed in time.</p>
              <Link href="/" className="btn-primary mt-4">
                Search again
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
