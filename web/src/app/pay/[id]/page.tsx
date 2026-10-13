import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadBookingForPage } from "@/lib/booking-access";
import { expireStaleHolds, serializeBooking } from "@/lib/booking";
import { isDemoPayments } from "@/lib/payment";
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
    <div className="mx-auto grid max-w-4xl gap-4 px-4 py-8 md:grid-cols-[1fr_320px]">
      <div className="card p-5">
        <h1 className="mb-3 text-xl font-bold">Review your booking</h1>
        <BookingSummary b={b} />
      </div>
      <div className="card h-fit p-5">
        {b.status === "PENDING" ? (
          <PayPanel
            bookingId={b.id}
            payToken={t}
            amount={b.totalAmount}
            expiresAt={b.holdExpiresAt!.toISOString()}
            demo={isDemoPayments()}
            confirmUrl={confirmUrl}
            prefill={{ name: b.passengerName, contact: b.passengerPhone }}
          />
        ) : (
          <div className="text-center">
            <p className="text-4xl">⌛</p>
            <p className="mt-2 font-bold">This booking has {b.status === "CANCELLED" ? "been cancelled" : "expired"}.</p>
            <p className="text-sm text-slate-500">The seats or vehicle were released because payment was not completed in time.</p>
            <Link href="/" className="btn-primary mt-4">Search again</Link>
          </div>
        )}
      </div>
    </div>
  );
}
