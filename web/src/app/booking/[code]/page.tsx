import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { loadBookingForPage } from "@/lib/booking-access";
import { bookingLinks, expireStaleHolds, serializeBooking } from "@/lib/booking";
import { getSettings } from "@/lib/settings";
import { inr } from "@/lib/format";
import BookingSummary, { STATUS_STYLE } from "@/components/BookingSummary";
import CancelButton from "@/components/CancelButton";

export const metadata = { title: "Booking details" };

export default async function BookingPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ code }, { t }] = await Promise.all([params, searchParams]);
  await expireStaleHolds();
  const access = await loadBookingForPage(code, t);
  if (!access) notFound();
  const b = serializeBooking(access.booking, (await getSettings()).cancellationSlabs);
  const links = await bookingLinks(access.booking, b);
  const qrSvg = b.qrData ? await QRCode.toString(b.qrData, { type: "svg", margin: 1, width: 180 }) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      {b.status === "CONFIRMED" && b.tripStatus !== "COMPLETED" && (
        <div className="rounded-xl bg-green-600 p-5 text-white">
          <p className="text-2xl font-bold">🎉 Booking confirmed!</p>
          <p className="text-green-100">
            Booking ID <b className="font-mono">{b.code}</b>.{" "}
            {b.driver ? `Your driver is ${b.driver.name}.` : "We will share driver and vehicle details before your trip."}
          </p>
        </div>
      )}

      {(b.boardingOtp || b.endOtp) && (
        <div className="card flex flex-col items-center gap-4 p-5 sm:flex-row">
          {qrSvg && <div className="h-44 w-44 shrink-0" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
          <div className="text-center sm:text-left">
            {b.boardingOtp ? (
              <>
                <p className="text-sm font-semibold uppercase text-slate-500">{b.kind === "SEAT" ? "Boarding pass" : "Trip start OTP"}</p>
                <p className="text-4xl font-extrabold tracking-[0.3em]">{b.boardingOtp}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {b.kind === "SEAT" ? "Show this QR code or tell the OTP to the driver when you board." : "Give this OTP to the driver when the trip starts."}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold uppercase text-slate-500">Trip end OTP</p>
                <p className="text-4xl font-extrabold tracking-[0.3em]">{b.endOtp}</p>
                <p className="mt-1 text-sm text-slate-500">Give this OTP to the driver only when you reach your destination.</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">Booking details</h1>
          <span className={`badge ${STATUS_STYLE[b.status] ?? ""}`}>{b.tripStatus === "STARTED" && b.status === "CONFIRMED" ? "ON TRIP" : b.status}</span>
        </div>
        <BookingSummary b={b} />
        {b.paymentStatus === "REFUND_PENDING" && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Your refund of {inr(b.refundAmount ?? 0)} is being processed and will reach your account in 5–7 working days.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {b.status === "PENDING" && (
            <Link href={`/pay/${b.id}${t ? `?t=${encodeURIComponent(t)}` : ""}`} className="btn-accent">
              Complete payment
            </Link>
          )}
          {links.trackUrl && (
            <a href={links.trackUrl} className="btn-primary">📍 Track vehicle</a>
          )}
          {links.invoiceUrl && (
            <a href={links.invoiceUrl} className="btn-ghost" target="_blank">🧾 Tax invoice</a>
          )}
          {access.isOwner && b.canCancel && b.cancellation && <CancelButton bookingId={b.id} refund={b.cancellation.refundAmount} charge={b.cancellation.charge} paid={b.paymentStatus === "PAID"} />}
          {access.isOwner && <Link href="/my-bookings" className="btn-ghost">All my trips</Link>}
        </div>
        {access.isOwner && b.canCancel && b.cancellation && b.paymentStatus === "PAID" && (
          <p className="mt-3 text-xs text-slate-400">
            If you cancel now you get {b.cancellation.refundPercent}% of the fare back ({inr(b.cancellation.refundAmount)}).
          </p>
        )}
        {access.isOwner && b.status === "CONFIRMED" && !b.canCancel && b.tripStatus === "SCHEDULED" && (
          <p className="mt-3 text-xs text-slate-400">Online cancellation is closed for this booking. Call {process.env.NEXT_PUBLIC_SUPPORT_PHONE} for help.</p>
        )}
      </div>
    </div>
  );
}
