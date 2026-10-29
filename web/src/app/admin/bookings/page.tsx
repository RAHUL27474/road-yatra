import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { bookingInclude, bookingLinks, cancellationQuote, expireStaleHolds, serializeBooking } from "@/lib/booking";
import { getSettings } from "@/lib/settings";
import { fmtDateTime, inr } from "@/lib/format";
import { bookingTitle, PAYMENT_LABEL, STATUS_STYLE } from "@/components/BookingSummary";
import Flash from "@/components/Flash";
import { updateBooking } from "../actions";
import OpButton from "../OpButton";

const STATUSES = ["ALL", "CONFIRMED", "PENDING", "COMPLETED", "CANCELLED", "EXPIRED"];

export default async function AdminBookings({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string; q?: string; error?: string }> }) {
  const { status = "ALL", kind = "ALL", q = "", error } = await searchParams;
  await expireStaleHolds();

  const where: Prisma.BookingWhereInput = {};
  if (status !== "ALL") where.status = status;
  if (kind !== "ALL") where.kind = kind;
  if (q) {
    // Postgres "contains" is case-sensitive; try the common spellings of a name.
    const title = q.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    const names = [...new Set([q, q.toLowerCase(), q.toUpperCase(), title])].map((n) => ({ passengerName: { contains: n } }));
    where.OR = [{ code: { contains: q.toUpperCase() } }, ...names, { passengerPhone: { contains: q } }];
  }
  const [rows, drivers, settings] = await Promise.all([
    db.booking.findMany({ where, include: { ...bookingInclude, user: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.driver.findMany({ where: { active: true, status: "APPROVED" }, include: { user: true } }),
    getSettings(),
  ]);

  const link = (p: Record<string, string>) => `/admin/bookings?${new URLSearchParams({ status, kind, q, ...p })}`;
  const back = link({});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Bookings</h1>
        <Link href="/admin/bookings/new" className="btn-primary">+ Phone booking (full cab)</Link>
      </div>
      <Flash error={error} />
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <Link key={s} href={link({ status: s })} className={`rounded-full px-3 py-1 text-xs font-semibold ${s === status ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>
              {s}
            </Link>
          ))}
        </div>
        <div className="flex gap-1">
          {[
            ["ALL", "ALL"],
            ["SEAT", "SHARED"],
            ["RENTAL", "FULL CAB"],
          ].map(([k, label]) => (
            <Link key={k} href={link({ kind: k })} className={`rounded-full px-3 py-1 text-xs font-semibold ${k === kind ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
              {label}
            </Link>
          ))}
        </div>
        <form className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="kind" value={kind} />
          <input name="q" defaultValue={q} placeholder="Booking ID, name or phone" className="input min-w-0 flex-1 sm:w-56 sm:flex-none" />
          <button className="btn-ghost">Search</button>
        </form>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && <p className="card p-6 text-center text-slate-400">No bookings match.</p>}
        {await Promise.all(
          rows.map(async (row) => {
            const b = serializeBooking(row);
            const links = await bookingLinks(row, b);
            const active = b.status === "CONFIRMED" || b.status === "PENDING";
            const quote = cancellationQuote(row, settings.cancellationSlabs);
            const suggestedRefund = row.paymentStatus === "PAID" ? quote.refund : 0;
            return (
              <div key={b.id} className="card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      <span className="mr-2 font-mono">{b.code}</span>
                      {bookingTitle(b)}
                      {b.source === "OFFLINE" && <span className="badge ml-2 bg-purple-100 text-purple-700">PHONE</span>}
                    </p>
                    <p className="text-slate-500">
                      {b.startAt ? fmtDateTime(b.startAt) : ""} · {row.trip?.vehicle.regNumber ?? row.vehicle?.regNumber} {b.vehicle?.name}
                      {b.seatNos.length ? ` · Seats ${b.seatNos.join(", ")}` : ` · ${b.estimatedKm} km`}
                      {b.driver ? ` · Driver ${b.driver.name}` : ""}
                    </p>
                    <p>
                      {b.passengerName} · <a className="text-brand" href={`tel:${b.passengerPhone}`}>{b.passengerPhone}</a> · {b.passengers} pax
                      {b.pickupStop ? ` · ${b.pickupStop.name} → ${b.dropStop?.name ?? ""}` : ""}
                      {b.pickupAddress ? ` · Pickup: ${b.pickupAddress}` : ""}
                      {b.dropAddress ? ` · Drop: ${b.dropAddress}` : ""}
                    </p>
                    <p className="text-xs text-slate-400">
                      Booked by {row.user.name} ({row.user.phone}) on {fmtDateTime(b.createdAt)}
                      {row.paymentId ? ` · ${row.paymentMode}: ${row.paymentId}` : ""}
                      {row.boardedAt ? ` · Boarded ${fmtDateTime(row.boardedAt)}` : ""}
                      {row.noShow ? " · NO-SHOW" : ""}
                      {row.startOdometer != null ? ` · Odometer ${row.startOdometer}${row.endOdometer != null ? `→${row.endOdometer} (${row.endOdometer - row.startOdometer} km)` : ""}` : ""}
                    </p>
                    {row.adminNote && <p className="mt-1 text-xs text-amber-700">Note: {row.adminNote}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{inr(b.totalAmount)}</p>
                    <span className={`badge ${STATUS_STYLE[b.status] ?? ""}`}>{b.tripStatus === "STARTED" && b.status === "CONFIRMED" ? "ON TRIP" : b.status}</span>{" "}
                    <span className="badge bg-slate-100 text-slate-600">
                      {b.paymentMode === "CASH" && b.paymentStatus === "UNPAID" ? "CASH DUE" : PAYMENT_LABEL[b.paymentStatus]}
                    </span>
                    {b.status === "CANCELLED" && b.refundAmount != null && <p className="text-xs text-slate-500">Refund {inr(b.refundAmount)}</p>}
                    {links.invoiceUrl && (
                      <p>
                        <a href={links.invoiceUrl} target="_blank" className="text-xs font-semibold text-brand">Invoice {row.invoiceNo}</a>
                      </p>
                    )}
                    {links.trackUrl && (
                      <p>
                        <a href={links.trackUrl} target="_blank" className="text-xs font-semibold text-brand">Live tracking</a>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                  <form action={updateBooking} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="op" value="note" />
                    <input name="note" placeholder="Note" defaultValue={row.adminNote ?? ""} className="input w-48 py-1" />
                    <button className="btn-ghost py-1">Save note</button>
                  </form>
                  {(b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL") && b.status === "CONFIRMED" && (
                    <>
                      <OpButton id={b.id} back={back} op="cash" className="btn-ghost py-1">Cash received</OpButton>
                      <OpButton id={b.id} back={back} op="upi" className="btn-ghost py-1">UPI received</OpButton>
                    </>
                  )}
                  {b.status === "CONFIRMED" && (
                    <OpButton id={b.id} back={back} op="complete" className="btn-ghost py-1">
                      Mark completed
                    </OpButton>
                  )}
                  {b.paymentStatus === "REFUND_PENDING" && (
                    <OpButton id={b.id} back={back} op="refunded" className="btn-primary py-1">
                      Mark refunded
                    </OpButton>
                  )}
                  {row.seatRefundDue > 0 && (
                    <OpButton id={b.id} back={back} op="seatRefunded" className="btn-primary py-1" title="Refund owed for seats the customer cancelled">
                      Seat refund {inr(row.seatRefundDue)} done
                    </OpButton>
                  )}

                  {b.kind === "RENTAL" && b.status === "CONFIRMED" && b.tripStatus !== "COMPLETED" && (
                    <form action={updateBooking} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="op" value="assign" />
                      <select name="driverId" defaultValue={row.driverId ?? ""} className="input py-1">
                        <option value="">No driver</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>{d.user.name}</option>
                        ))}
                      </select>
                      <button className="btn-ghost py-1">Assign</button>
                      {row.driverId && row.driverResponse === "ACCEPTED" && <span className="text-xs font-semibold text-green-700">accepted</span>}
                      {row.driverId && !row.driverResponse && <span className="text-xs font-semibold text-amber-700">not accepted yet</span>}
                      {!row.driverId && row.driverNote && <span className="text-xs font-semibold text-red-600">{row.driverNote}</span>}
                    </form>
                  )}

                  {active && (
                    <form action={updateBooking} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="op" value="cancel" />
                      {row.paymentStatus === "PAID" && (
                        <label className="flex items-center gap-1 text-xs">
                          Refund ₹
                          <input name="refundAmount" type="number" min={0} max={b.totalAmount} defaultValue={suggestedRefund} className="input w-24 py-1" />
                        </label>
                      )}
                      <button className="btn-ghost py-1 text-red-600">Cancel booking</button>
                    </form>
                  )}
                </div>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
