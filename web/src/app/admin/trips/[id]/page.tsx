import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { cashDue } from "@/lib/booking";
import { BLOCK_REASONS, fmtDateTime, fmtTime, inr } from "@/lib/format";
import { STATUS_STYLE } from "@/components/BookingSummary";
import Flash from "@/components/Flash";
import { assignTripDriver, blockSeats, offlineSeatBooking, unblockSeat, updateBooking } from "../../actions";

/** Trip control: driver, seat blocking, phone bookings and the passenger manifest (print it for the driver). */
export default async function TripManifest({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; created?: string }> }) {
  const [{ id }, { error, created }] = await Promise.all([params, searchParams]);
  const trip = await db.trip.findUnique({
    where: { id },
    include: {
      route: true,
      vehicle: true,
      driver: { include: { user: true } },
      seats: true,
      bookings: { where: { status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] } }, include: { pickupStop: true, dropStop: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!trip) notFound();
  const [drivers, stops] = await Promise.all([
    db.driver.findMany({ where: { active: true, status: "APPROVED" }, include: { user: true } }),
    db.stop.findMany({ where: { active: true, city: { in: [trip.route.fromCity, trip.route.toCity] } }, orderBy: { sortOrder: "asc" } }),
  ]);

  const seatState = new Map(trip.seats.map((s) => [s.seatNo, s]));
  const allSeats = Array.from({ length: trip.vehicle.seats }, (_, i) => i + 1);
  const freeSeats = allSeats.filter((n) => !seatState.has(n));
  const blocked = trip.seats.filter((s) => !s.bookingId);
  const confirmed = trip.bookings.filter((b) => b.status !== "PENDING");
  const sold = confirmed.reduce((n, b) => n + b.passengers, 0);
  const cashToCollect = confirmed.reduce((n, b) => n + cashDue(b), 0);
  const editable = trip.status === "SCHEDULED";
  const back = `/admin/trips/${trip.id}`;

  const seatCheckboxes = (name: string) =>
    freeSeats.length === 0 ? (
      <p className="text-sm text-slate-400">No free seats.</p>
    ) : (
      <div className="flex flex-wrap gap-2">
        {freeSeats.map((n) => (
          <label key={n} className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-light">
            <input type="checkbox" name={name} value={n} className="accent-brand" /> {n}
          </label>
        ))}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="page-title">
            {trip.route.fromCity} → {trip.route.toCity}
          </h1>
          <p className="text-slate-500">
            {fmtDateTime(trip.departAt)} → {fmtTime(trip.arriveAt)} · {trip.vehicle.name} ({trip.vehicle.regNumber}) · {inr(trip.fare)}/seat
          </p>
          <p className="text-sm">
            <b>{sold}</b>/{trip.vehicle.seats} seats sold · {blocked.length} blocked · cash to collect <b>{inr(cashToCollect)}</b>
          </p>
        </div>
        <span className="badge bg-slate-100 text-base text-slate-700">{trip.status}</span>
      </div>
      <Flash error={error} success={created ? `Phone booking ${created} created and confirmed.` : undefined} />

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={assignTripDriver} className="card space-y-2 p-4 print:hidden">
          <h2 className="font-bold">Driver</h2>
          <input type="hidden" name="id" value={trip.id} />
          <div className="flex gap-2">
            <select name="driverId" className="input" defaultValue={trip.driverId ?? ""} disabled={trip.status === "COMPLETED"}>
              <option value="">— Not assigned —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.user.name} · {d.user.phone}
                </option>
              ))}
            </select>
            <button className="btn-primary" disabled={trip.status === "COMPLETED"}>Save</button>
          </div>
          {trip.driverId && trip.driverResponse === "ACCEPTED" && <p className="text-sm font-semibold text-green-700">Driver accepted this trip in the app.</p>}
          {trip.driverId && !trip.driverResponse && trip.status === "SCHEDULED" && <p className="text-sm font-semibold text-amber-700">Waiting for the driver to accept in the app.</p>}
          {!trip.driverId && trip.driverNote && <p className="text-sm font-semibold text-red-600">{trip.driverNote}</p>}
          <p className="text-xs text-slate-500">
            The driver gets the duty in the app (and on WhatsApp once it is set up). Passengers get the driver&apos;s name, number and a
            live-tracking link.
          </p>
        </form>

        <div className="card p-4">
          <h2 className="mb-2 font-bold">Seats</h2>
          <div className="flex flex-wrap gap-2">
            {allSeats.map((n) => {
              const s = seatState.get(n);
              const style = !s ? "border-green-500 text-green-700" : s.bookingId ? "border-slate-400 bg-slate-300 text-slate-700" : "border-amber-500 bg-amber-100 text-amber-800";
              return (
                <div key={n} className={`flex items-center gap-1 rounded-lg border-2 px-2 py-1 text-sm font-semibold ${style}`} title={s?.blockReason ?? ""}>
                  {n}
                  {s && !s.bookingId && (
                    <>
                      <span className="text-[10px] font-normal">{s.blockReason}</span>
                      {editable && (
                        <form action={unblockSeat} className="inline print:hidden">
                          <input type="hidden" name="tripId" value={trip.id} />
                          <input type="hidden" name="seatNo" value={n} />
                          <button title="Unblock" className="ml-1 text-red-600">×</button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">Green = free · grey = booked · amber = blocked</p>
        </div>
      </div>

      {editable && (
        <div className="grid gap-4 lg:grid-cols-2 print:hidden">
          <form action={offlineSeatBooking} className="card space-y-3 p-4">
            <h2 className="font-bold">Phone / walk-in booking</h2>
            <input type="hidden" name="tripId" value={trip.id} />
            {seatCheckboxes("seatNos")}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="female" className="accent-pink-600" /> Woman passenger (all selected seats) — needed for women-only seats
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="passengerName" className="input" placeholder="Passenger name" required />
              <input name="passengerPhone" className="input" placeholder="Mobile number" required inputMode="numeric" pattern="[6-9][0-9]{9}" />
              <select name="pickupStopId" className="input">
                {stops.filter((s) => s.city === trip.route.fromCity).map((s) => (
                  <option key={s.id} value={s.id}>Pickup: {s.name}</option>
                ))}
              </select>
              <select name="dropStopId" className="input">
                {stops.filter((s) => s.city === trip.route.toCity).map((s) => (
                  <option key={s.id} value={s.id}>Drop: {s.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="paid" className="accent-brand" /> Already paid (cash/UPI received at office)
            </label>
            <button className="btn-primary">Book &amp; confirm</button>
          </form>

          <form action={blockSeats} className="card space-y-3 p-4">
            <h2 className="font-bold">Block seats</h2>
            <input type="hidden" name="tripId" value={trip.id} />
            {seatCheckboxes("seatNos")}
            <select name="reason" className="input" required>
              {BLOCK_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <button className="btn-ghost">Block selected seats</button>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-bold">Passenger manifest</h2>
          <p className="text-xs text-slate-500 print:hidden">Use your browser&apos;s Print to give the driver a paper copy.</p>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Seats</th>
              <th>Passenger</th>
              <th>Pickup → drop</th>
              <th>Booking</th>
              <th>Payment</th>
              <th>Boarding</th>
              <th className="print:hidden" />
            </tr>
          </thead>
          <tbody>
            {trip.bookings.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">No bookings yet.</td>
              </tr>
            )}
            {trip.bookings.map((b) => (
              <tr key={b.id}>
                <td className="text-lg font-bold">{b.seatNos}</td>
                <td>
                  {b.passengerName}
                  <br />
                  <a href={`tel:${b.passengerPhone}`} className="text-brand">{b.passengerPhone}</a>
                </td>
                <td className="text-xs">
                  {b.pickupStop?.name ?? trip.route.fromCity}
                  <br />→ {b.dropStop?.name ?? trip.route.toCity}
                </td>
                <td>
                  <span className="font-mono">{b.code}</span>
                  {b.source === "OFFLINE" && <span className="badge ml-1 bg-purple-100 text-purple-700">PHONE</span>}
                  <br />
                  <span className={`badge ${STATUS_STYLE[b.status] ?? ""}`}>{b.status === "PENDING" ? "AWAITING PAYMENT" : b.status}</span>
                </td>
                <td className="text-xs">
                  {cashDue(b) > 0 ? <b className="text-amber-700">Collect {inr(cashDue(b))}</b> : `${b.paymentStatus} · ${inr(b.totalAmount)}`}
                </td>
                <td className="text-xs">{b.boardedAt ? `Boarded ${fmtTime(b.boardedAt)}` : b.noShow ? "No-show" : "—"}</td>
                <td className="print:hidden">
                  {cashDue(b) > 0 && b.status !== "PENDING" && (
                    <form action={updateBooking}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="back" value={back} />
                      <button name="action" value="cash" className="text-xs font-semibold text-brand">Mark paid</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
