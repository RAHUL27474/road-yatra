import { notFound } from "next/navigation";
import { loadBookingForPage } from "@/lib/booking-access";
import { serializeBooking, GST_RATE } from "@/lib/booking";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { bookingTitle } from "@/components/BookingSummary";
import PrintButton from "./PrintButton";

export const metadata = { title: "Tax invoice" };

// Place of supply for passenger transport is where the journey starts. Add states here as you expand.
const CITY_STATE: Record<string, [string, string]> = {
  Delhi: ["Delhi", "07"],
  Bareilly: ["Uttar Pradesh", "09"],
  Moradabad: ["Uttar Pradesh", "09"],
};

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ code }, { t }] = await Promise.all([params, searchParams]);
  const access = await loadBookingForPage(code, t);
  if (!access || !access.booking.invoiceNo) notFound();
  const raw = access.booking;
  const b = serializeBooking(raw);
  const { business } = await getSettings();

  const startCity = b.trip?.fromCity ?? b.pickupCity ?? "";
  const [posName, posCode] = CITY_STATE[startCity] ?? [business.stateName, business.stateCode];
  const interState = posCode !== business.stateCode;
  const half = Math.round((b.taxAmount / 2) * 100) / 100;
  const description =
    b.kind === "SEAT"
      ? `Passenger transport: ${bookingTitle(b)}, ${b.seatNos.length} seat(s) [${b.seatNos.join(", ")}], ${b.startAt ? fmtDateTime(b.startAt) : ""}`
      : `Cab hire with driver: ${bookingTitle(b)}, ${b.vehicle?.name ?? ""}, ${b.estimatedKm} km, ${b.startAt ? fmtDateTime(b.startAt) : ""}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-3 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <div className="card p-8 text-sm print:shadow-none print:ring-0">
        <div className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xl font-extrabold">{business.legalName}</p>
            <p className="whitespace-pre-line text-slate-600">{business.address}</p>
            {business.gstin && <p>GSTIN: <b>{business.gstin}</b></p>}
            <p>State: {business.stateName} ({business.stateCode})</p>
            {business.email && <p>{business.email}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase">Tax Invoice</p>
            <p>Invoice no: <b>{raw.invoiceNo}</b></p>
            <p>Date: {fmtDate(raw.paidAt ?? raw.createdAt)}</p>
            <p>Booking: {b.code}</p>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-200 py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Billed to</p>
            <p className="font-semibold">{b.passengerName}</p>
            <p>{b.passengerPhone}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase text-slate-500">Place of supply</p>
            <p>
              {posName} ({posCode})
            </p>
            <p className="text-slate-500">Payment: {raw.paymentMode === "CASH" ? "Cash" : "Online"}</p>
          </div>
        </div>

        <table className="table mt-4">
          <thead>
            <tr>
              <th>Description</th>
              <th>SAC</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{description}</td>
              <td>{business.sacCode}</td>
              <td className="text-right">{inr(b.baseAmount)}</td>
            </tr>
            {interState ? (
              <tr>
                <td colSpan={2}>IGST @ {GST_RATE * 100}%</td>
                <td className="text-right">{inr(b.taxAmount)}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td colSpan={2}>CGST @ {(GST_RATE * 100) / 2}%</td>
                  <td className="text-right">₹{half.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={2}>SGST @ {(GST_RATE * 100) / 2}%</td>
                  <td className="text-right">₹{(b.taxAmount - half).toFixed(2)}</td>
                </tr>
              </>
            )}
            {b.extraCharges > 0 && (
              <tr>
                <td colSpan={2}>Toll &amp; parking (reimbursement at actuals, not a taxable supply)</td>
                <td className="text-right">{inr(b.extraCharges)}</td>
              </tr>
            )}
            <tr className="font-bold">
              <td colSpan={2}>Total</td>
              <td className="text-right">{inr(b.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        {b.status === "CANCELLED" && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-amber-800">
            This booking was cancelled on {b.cancelledAt ? fmtDate(b.cancelledAt) : "—"}. Refund: {inr(b.refundAmount ?? 0)}. Cancellation charge: {inr(b.cancellationCharge ?? 0)}.
          </p>
        )}
        <p className="mt-6 text-xs text-slate-400">This is a computer-generated invoice and does not need a signature.</p>
      </div>
    </div>
  );
}
