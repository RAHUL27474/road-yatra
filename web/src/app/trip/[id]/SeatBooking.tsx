"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Armchair, ArrowRight, CircleDot, Flag, Info, MapPin, Phone, UserRound } from "lucide-react";
import SeatMap, { SeatLegend } from "@/components/SeatMap";
import PaymentChoice, { type Payment } from "@/components/PaymentChoice";
import { apiFetch, payPath } from "@/lib/client";
import { inr } from "@/lib/format";

type Stop = { id: string; name: string; address: string };
type Props = {
  trip: {
    id: string;
    fare: number;
    fromCity: string;
    toCity: string;
    takenSeats: number[];
    vehicle: { seats: number; seatsPerRow: number; aisleAfter: number; seatLayout?: string };
  };
  pickupStops: Stop[];
  dropStops: Stop[];
  allowCash: boolean;
  allowOnline: boolean;
  user: { name: string; phone: string } | null;
  /** Display-only details for the summary panel. */
  summary?: { departLabel: string; vehicleName: string };
};

export default function SeatBooking({ trip, pickupStops, dropStops, allowCash, allowOnline, user, summary }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [pickup, setPickup] = useState(pickupStops[0]?.id ?? "");
  const [drop, setDrop] = useState(dropStops[0]?.id ?? "");
  const [payment, setPayment] = useState<Payment>(allowOnline ? "ONLINE" : "CASH");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const base = selected.length * trip.fare;
  const tax = Math.round(base * 0.05);
  const available = trip.vehicle.seats - trip.takenSeats.length;

  function toggle(seat: number) {
    setSelected((s) => (s.includes(seat) ? s.filter((x) => x !== seat) : s.length >= 10 ? s : [...s, seat].sort((a, b) => a - b)));
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return router.push(`/login?next=/trip/${trip.id}`);
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch<{ payUrl: string | null; booking: { code: string } }>("/api/bookings", {
        body: {
          kind: "SEAT",
          tripId: trip.id,
          seatNos: selected,
          passengerName: name,
          passengerPhone: phone,
          pickupStopId: pickup || undefined,
          dropStopId: drop || undefined,
          payment,
        },
      });
      router.push(res.payUrl ? payPath(res.payUrl) : `/booking/${res.booking.code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      router.refresh();
    }
  }

  const ctaLabel = busy ? "Booking your seats…" : !user ? "Login to continue" : payment === "CASH" ? "Confirm booking" : "Proceed to pay";
  const pickupName = pickupStops.find((s) => s.id === pickup)?.name;
  const dropName = dropStops.find((s) => s.id === drop)?.name;

  const stopCards = (title: string, icon: React.ReactNode, name: string, stops: Stop[], value: string, onChange: (v: string) => void) =>
    stops.length > 0 && (
      <fieldset>
        <legend className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
          {icon} {title}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {stops.map((s) => {
            const active = value === s.id;
            return (
              <label
                key={s.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${active ? "border-brand bg-brand-light/50" : "border-slate-200 hover:border-slate-300"}`}
              >
                <input type="radio" name={name} value={s.id} checked={active} onChange={() => onChange(s.id)} className="sr-only" />
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${active ? "border-brand" : "border-slate-300"}`} aria-hidden>
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{s.name}</span>
                  {s.address && <span className="block text-xs text-slate-500">{s.address}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );

  return (
    <form onSubmit={book} className="grid gap-6 pb-24 lg:grid-cols-[1fr_360px] lg:pb-0">
      <div className="min-w-0 space-y-6">
        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <Armchair className="h-5 w-5 text-brand" aria-hidden /> Choose your seats
              </h2>
              <p className="text-sm text-slate-500">
                {available} of {trip.vehicle.seats} seats available · up to 10 per booking
              </p>
            </div>
            <SeatLegend />
          </div>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center sm:gap-10">
            <SeatMap {...trip.vehicle} taken={trip.takenSeats} selected={selected} onToggle={toggle} />
            <div className="w-full max-w-xs space-y-3 text-sm sm:pt-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase">Selected seats</p>
                <p className="mt-1 text-lg font-bold text-ink">{selected.length ? selected.join(", ") : "None yet"}</p>
                <p className="text-xs text-slate-500">{inr(trip.fare)} per seat</p>
              </div>
              <p className="flex gap-2 text-xs text-slate-500">
                <Info className="h-4 w-4 shrink-0 text-brand" aria-hidden /> Tap a green seat to select it. Tap again to remove it.
              </p>
            </div>
          </div>
        </section>

        {(pickupStops.length > 0 || dropStops.length > 0) && (
          <section className="card space-y-5 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <MapPin className="h-5 w-5 text-brand" aria-hidden /> Pickup & drop
            </h2>
            {stopCards(`Pickup point in ${trip.fromCity}`, <CircleDot className="h-4 w-4 text-green-600" aria-hidden />, "pickup", pickupStops, pickup, setPickup)}
            {stopCards(`Drop point in ${trip.toCity}`, <Flag className="h-4 w-4 text-red-500" aria-hidden />, "drop", dropStops, drop, setDrop)}
          </section>
        )}

        <section className="card space-y-5 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <UserRound className="h-5 w-5 text-brand" aria-hidden /> Passenger details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pname">
                Full name
              </label>
              <input id="pname" className="input" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <div>
              <label className="label" htmlFor="pphone">
                Mobile number
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  id="pphone"
                  className="input pl-9"
                  required
                  inputMode="numeric"
                  pattern="[6-9][0-9]{9}"
                  title="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel-national"
                />
              </div>
            </div>
          </div>
          <PaymentChoice value={payment} onChange={setPayment} allowCash={allowCash} allowOnline={allowOnline} />
        </section>
      </div>

      {/* Desktop summary */}
      <aside className="hidden lg:block">
        <div className="card sticky top-24 overflow-hidden">
          <div className="bg-gradient-to-r from-brand-dark to-brand p-5 text-white">
            <p className="flex items-center gap-2 text-lg font-bold">
              {trip.fromCity} <ArrowRight className="h-4 w-4" aria-hidden /> {trip.toCity}
            </p>
            {summary && (
              <p className="text-sm text-blue-100">
                {summary.departLabel} · {summary.vehicleName}
              </p>
            )}
          </div>
          <div className="space-y-4 p-5 text-sm">
            {(pickupName || dropName) && (
              <div className="space-y-2">
                {pickupName && (
                  <p className="flex gap-2">
                    <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden /> {pickupName}
                  </p>
                )}
                {dropName && (
                  <p className="flex gap-2">
                    <Flag className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden /> {dropName}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Seats</span>
                <b>{selected.length ? selected.join(", ") : "—"}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Fare ({selected.length} × {inr(trip.fare)})
                </span>
                <span>{inr(base)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GST (5%)</span>
                <span>{inr(tax)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-extrabold text-ink">
                <span>Total</span>
                <span>{inr(base + tax)}</span>
              </div>
            </div>
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button className="btn-accent btn-lg w-full" disabled={!selected.length || busy}>
              {ctaLabel}
            </button>
            <p className="text-center text-xs text-slate-400">
              {payment === "CASH" ? "Your seats are confirmed now. Pay the driver when you board." : "Seats are held for 10 minutes while you pay."}
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgb(15_23_42/0.1)] backdrop-blur lg:hidden">
        {error && <p className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        <div className="container-x flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-500">
              {selected.length ? `Seat${selected.length > 1 ? "s" : ""} ${selected.join(", ")} · incl. GST` : "Select seats to continue"}
            </p>
            <p className="text-xl font-extrabold text-ink">{inr(base + tax)}</p>
          </div>
          <button className="btn-accent px-5 py-3" disabled={!selected.length || busy}>
            {ctaLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
