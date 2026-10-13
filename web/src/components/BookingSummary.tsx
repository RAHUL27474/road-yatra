import type { serializeBooking } from "@/lib/booking";
import { fmtDateTime, inr, RENTAL_TYPES } from "@/lib/format";

type B = ReturnType<typeof serializeBooking>;

export const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-green-100 text-green-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-red-100 text-red-700",
  EXPIRED: "bg-slate-200 text-slate-600",
};

export const PAYMENT_LABEL: Record<string, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
  REFUND_PENDING: "Refund pending",
  REFUNDED: "Refunded",
};

export function bookingTitle(b: B) {
  if (b.trip) return `${b.trip.fromCity} → ${b.trip.toCity}`;
  return `${RENTAL_TYPES[b.rentalType ?? ""] ?? "Full cab"} · ${b.pickupCity}${b.dropCity ? ` → ${b.dropCity}` : ""}`;
}

export function paymentText(b: B) {
  if (b.paymentMode === "CASH" && b.paymentStatus === "UNPAID") return `Pay ${inr(b.totalAmount)} in cash to the driver`;
  return PAYMENT_LABEL[b.paymentStatus] ?? b.paymentStatus;
}

export default function BookingSummary({ b }: { b: B }) {
  const rows: [string, React.ReactNode][] = [
    ["Booking ID", <b key="c" className="font-mono">{b.code}</b>],
    ["Journey", bookingTitle(b)],
    [b.kind === "SEAT" ? "Departure" : "Pickup time", b.startAt ? fmtDateTime(b.startAt) : "—"],
  ];
  if (b.trip) {
    rows.push(["Pickup point", b.pickupStop ? `${b.pickupStop.name}${b.pickupStop.address ? `, ${b.pickupStop.address}` : ""}` : b.trip.fromCity]);
    rows.push(["Drop point", b.dropStop ? b.dropStop.name : b.trip.toCity]);
    rows.push(["Seats", b.seatNos.join(", ")]);
  } else {
    if (b.rentalType === "ROUND_TRIP" && b.endAt) rows.push(["Trip ends (approx.)", fmtDateTime(b.endAt)]);
    rows.push(["Pickup address", b.pickupAddress]);
    if (b.dropAddress) rows.push(["Drop address", b.dropAddress]);
    rows.push(["Included distance", `${b.estimatedKm} km`]);
  }
  rows.push(["Vehicle", b.vehicle ? `${b.vehicle.name}${b.vehicleNumber ? ` · ${b.vehicleNumber}` : ""}` : "—"]);
  if (b.driver) rows.push(["Driver", <span key="d">{b.driver.name} · <a className="text-brand" href={`tel:${b.driver.phone}`}>{b.driver.phone}</a></span>]);
  rows.push(["Traveller", `${b.passengerName} · ${b.passengerPhone} · ${b.passengers} pax`]);
  rows.push(["Payment", paymentText(b)]);

  return (
    <div className="text-sm">
      <dl className="divide-y divide-slate-100">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3">
        <div className="flex justify-between"><span>Fare</span><span>{inr(b.baseAmount)}</span></div>
        <div className="flex justify-between"><span>GST</span><span>{inr(b.taxAmount)}</span></div>
        {b.extraCharges > 0 && <div className="flex justify-between"><span>Toll &amp; parking</span><span>{inr(b.extraCharges)}</span></div>}
        <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold"><span>Total</span><span>{inr(b.totalAmount)}</span></div>
        {b.status === "CANCELLED" && b.refundAmount != null && (
          <div className="flex justify-between text-slate-500"><span>Refund</span><span>{inr(b.refundAmount)}</span></div>
        )}
      </div>
    </div>
  );
}
