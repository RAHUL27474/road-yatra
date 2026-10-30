import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CircleCheck, CircleX, Clock, CreditCard, FileText, Hourglass, MapPinned, Ticket } from "lucide-react";
import { loadBookingForPage } from "@/lib/booking-access";
import ShareLocation from "@/components/ShareLocation";
import { bookingLinks, expireStaleHolds, serializeBooking } from "@/lib/booking";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtTime, inr, RENTAL_TYPES } from "@/lib/format";
import BookingSummary, { bookingTitle, STATUS_STYLE } from "@/components/BookingSummary";
import CancelButton from "@/components/CancelButton";
import { LogoMark } from "@/components/Logo";

export const metadata = { title: "Booking details" };

export default async function BookingPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ code }, { t }] = await Promise.all([params, searchParams]);
  await expireStaleHolds();
  const access = await loadBookingForPage(code, t);
  if (!access) notFound();
  const settings = await getSettings();
  const b = serializeBooking(access.booking, settings.cancellationSlabs);
  const links = await bookingLinks(access.booking, b);
  const qrSvg = b.qrData ? await QRCode.toString(b.qrData, { type: "svg", margin: 1, width: 180 }) : null;
  // UPI payment link (amount and booking code filled in), also drawn as a QR to scan from any UPI app.
  const upiLink =
    b.cashDue > 0 && b.status === "CONFIRMED" && settings.upiId
      ? `upi://pay?${new URLSearchParams({ pa: settings.upiId, pn: settings.upiName, am: b.cashDue.toFixed(2), cu: "INR", tn: `Booking ${b.code}` })}`
      : null;
  const upiQrSvg = upiLink ? await QRCode.toString(upiLink, { type: "svg", margin: 1, width: 180 }) : null;
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Jai Shree Shyam Tour & Travels";
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
  const from = b.trip?.fromCity ?? b.pickupCity ?? "";
  const to = b.trip?.toCity ?? b.dropCity ?? "";
  const statusLabel = b.tripStatus === "STARTED" && b.status === "CONFIRMED" ? "ON TRIP" : b.status;

  return (
    <div className="container-x max-w-3xl space-y-5 py-8">
      {b.status === "CONFIRMED" && b.tripStatus !== "COMPLETED" && (
        <div className="flex items-start gap-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 p-5 text-white shadow-lg shadow-green-600/20">
          <CircleCheck className="h-8 w-8 shrink-0" aria-hidden />
          <div>
            <p className="text-xl font-extrabold">Booking confirmed!</p>
            <p className="text-sm text-green-50">
              Booking ID <b className="font-mono">{b.code}</b>.{" "}
              {b.driver ? `Your driver is ${b.driver.name}.` : "We will share driver and vehicle details before your trip."}
            </p>
          </div>
        </div>
      )}
      {b.status === "PENDING" && (
        <div className="flex items-start gap-4 rounded-2xl bg-amber-50 p-5 text-amber-900 ring-1 ring-amber-200">
          <Hourglass className="h-7 w-7 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="font-bold">Payment pending</p>
            <p className="text-sm">Complete the payment to confirm this booking. Unpaid bookings are released automatically.</p>
          </div>
        </div>
      )}
      {b.status === "CANCELLED" && (
        <div className="flex items-start gap-4 rounded-2xl bg-red-50 p-5 text-red-900 ring-1 ring-red-200">
          <CircleX className="h-7 w-7 shrink-0 text-red-600" aria-hidden />
          <div>
            <p className="font-bold">This booking was cancelled</p>
            {b.cancelledAt && <p className="text-sm">Cancelled on {fmtDate(b.cancelledAt)}.</p>}
          </div>
        </div>
      )}

      {/* E-ticket */}
      <article className="overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-lift)] ring-1 ring-slate-200/70">
        <header className="flex items-center justify-between gap-3 bg-gradient-to-r from-brand-darker via-brand-dark to-brand px-5 py-4 text-white sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-12 w-12" />
            <div className="leading-tight">
              <p className="font-extrabold">{brand}</p>
              <p className="text-xs text-slate-300">{b.kind === "SEAT" ? "Shared seat e-ticket" : `Full cab · ${RENTAL_TYPES[b.rentalType ?? ""] ?? ""}`}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] tracking-wider text-slate-300 uppercase">Booking ID</p>
            <p className="font-mono text-lg font-bold">{b.code}</p>
          </div>
        </header>

        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase">From</p>
              <p className="truncate text-2xl font-extrabold text-ink">{from}</p>
              {b.startAt && <p className="text-sm text-slate-500">{fmtTime(b.startAt)}</p>}
            </div>
            <div className="flex flex-1 items-center gap-2 px-2 text-slate-300" aria-hidden>
              <span className="h-2 w-2 rounded-full border-2 border-brand" />
              <span className="h-px flex-1 border-t-2 border-dashed border-slate-300" />
              <Ticket className="h-5 w-5 text-brand" />
              <span className="h-px flex-1 border-t-2 border-dashed border-slate-300" />
              <span className="h-2 w-2 rounded-full bg-brand" />
            </div>
            <div className="min-w-0 text-right">
              <p className="text-xs font-semibold text-slate-400 uppercase">To</p>
              <p className="truncate text-2xl font-extrabold text-ink">{to || "Local"}</p>
              {b.trip && <p className="text-sm text-slate-500">{fmtTime(b.trip.arriveAt)}</p>}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Date</p>
              <p className="font-semibold text-ink">{b.startAt ? fmtDate(b.startAt) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{b.kind === "SEAT" ? "Seats" : "Passengers"}</p>
              <p className="font-semibold text-ink">{b.kind === "SEAT" ? b.seatNos.join(", ") : b.passengers}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Vehicle</p>
              <p className="font-semibold text-ink">{b.vehicle?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <span className={`badge mt-0.5 ${STATUS_STYLE[b.status] ?? ""}`}>{statusLabel}</span>
            </div>
          </div>
        </div>

        {(b.boardingOtp || b.endOtp) && (
          <>
            <div className="relative flex items-center" aria-hidden>
              <span className="absolute -left-3 h-6 w-6 rounded-full bg-canvas ring-1 ring-slate-200/70" />
              <span className="mx-5 w-full border-t-2 border-dashed border-slate-200" />
              <span className="absolute -right-3 h-6 w-6 rounded-full bg-canvas ring-1 ring-slate-200/70" />
            </div>
            <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:p-6">
              {qrSvg && <div className="h-44 w-44 shrink-0 rounded-2xl bg-white p-2 ring-1 ring-slate-200 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
              <div className="text-center sm:text-left">
                {b.boardingOtp ? (
                  <>
                    <p className="text-xs font-bold tracking-wider text-accent uppercase">{b.kind === "SEAT" ? "Boarding pass" : "Trip start OTP"}</p>
                    <p className="mt-1 text-5xl font-extrabold tracking-[0.3em] text-ink">{b.boardingOtp}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      {b.kind === "SEAT" ? "Show this QR code or tell the OTP to the driver when you board." : "Give this OTP to the driver when the trip starts."}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold tracking-wider text-accent uppercase">Trip end OTP</p>
                    <p className="mt-1 text-5xl font-extrabold tracking-[0.3em] text-ink">{b.endOtp}</p>
                    <p className="mt-2 text-sm text-slate-500">Give this OTP to the driver only when you reach your destination.</p>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </article>

      {/* Details & actions */}
      <section className="card p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-ink">Booking details</h1>
          <span className="text-sm text-slate-500">{bookingTitle(b)}</span>
        </div>
        <BookingSummary b={b} />
        {access.isOwner && b.canShareLocation && <ShareLocation bookingId={b.id} initiallySharing={!!b.sharedLocation} />}
        {upiLink && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm sm:flex-row sm:items-center">
            {upiQrSvg && (
              <div
                className="h-36 w-36 shrink-0 self-center rounded-xl bg-white p-1.5 ring-1 ring-green-200 [&_svg]:h-full [&_svg]:w-full"
                role="img"
                aria-label={`UPI QR code to pay ${inr(b.cashDue)}`}
                dangerouslySetInnerHTML={{ __html: upiQrSvg }}
              />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-green-800">
                Pay {inr(b.cashDue)} by UPI to <span className="font-mono break-all">{settings.upiId}</span>
              </p>
              <p className="mt-0.5 text-xs text-green-700">
                Scan the QR with any UPI app (PhonePe, Google Pay, Paytm, BHIM). The amount and note “{b.code}” are filled in. Pay now or when you board, then
                show the success screen to the driver.
              </p>
              <a href={upiLink} className="btn-primary mt-2 inline-block px-4 py-2 text-sm sm:hidden">
                Open UPI app
              </a>
            </div>
          </div>
        )}
        {b.paymentStatus === "REFUND_PENDING" && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Your refund of {inr(b.refundAmount ?? 0)} is being processed and will reach your account in 5–7 working days.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {b.status === "PENDING" && (
            <Link href={`/pay/${b.id}${t ? `?t=${encodeURIComponent(t)}` : ""}`} className="btn-accent">
              <CreditCard className="h-4 w-4" aria-hidden /> Complete payment
            </Link>
          )}
          {links.trackUrl && (
            <a href={links.trackUrl} className="btn-primary">
              <MapPinned className="h-4 w-4" aria-hidden /> Track vehicle
            </a>
          )}
          {links.invoiceUrl && (
            <a href={links.invoiceUrl} className="btn-ghost" target="_blank">
              <FileText className="h-4 w-4" aria-hidden /> Tax invoice
            </a>
          )}
          {access.isOwner && b.canCancel && b.cancellation && <CancelButton bookingId={b.id} refund={b.cancellation.refundAmount} charge={b.cancellation.charge} paid={b.paymentStatus === "PAID"} />}
          {access.isOwner && (
            <Link href="/my-bookings" className="btn-ghost">
              <Ticket className="h-4 w-4" aria-hidden /> All my trips
            </Link>
          )}
        </div>
        {access.isOwner && b.canCancel && b.cancellation && b.paymentStatus === "PAID" && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" aria-hidden /> If you cancel now you get {b.cancellation.refundPercent}% of the fare back ({inr(b.cancellation.refundAmount)}).
          </p>
        )}
        {access.isOwner && b.status === "CONFIRMED" && !b.canCancel && b.tripStatus === "SCHEDULED" && (
          <p className="mt-3 text-xs text-slate-500">Online cancellation is closed for this booking. Call {phone} for help.</p>
        )}
      </section>
    </div>
  );
}
