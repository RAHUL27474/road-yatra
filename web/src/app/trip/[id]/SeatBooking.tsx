"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SeatMap from "@/components/SeatMap";
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
    vehicle: { seats: number; seatsPerRow: number; aisleAfter: number };
  };
  pickupStops: Stop[];
  dropStops: Stop[];
  allowCash: boolean;
  user: { name: string; phone: string } | null;
};

export default function SeatBooking({ trip, pickupStops, dropStops, allowCash, user }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [pickup, setPickup] = useState(pickupStops[0]?.id ?? "");
  const [drop, setDrop] = useState(dropStops[0]?.id ?? "");
  const [payment, setPayment] = useState<Payment>("ONLINE");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const base = selected.length * trip.fare;
  const tax = Math.round(base * 0.05);

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

  const stopSelect = (label: string, stops: Stop[], value: string, onChange: (v: string) => void) =>
    stops.length > 0 && (
      <div>
        <label className="label">{label}</label>
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    );

  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr]">
      <div className="card p-5">
        <h2 className="mb-3 font-bold">Choose your seats</h2>
        <SeatMap {...trip.vehicle} taken={trip.takenSeats} selected={selected} onToggle={toggle} />
      </div>

      <form onSubmit={book} className="card h-fit space-y-4 p-5">
        <h2 className="font-bold">Passenger details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Full name</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Mobile number</label>
            <input className="input" required inputMode="numeric" pattern="[6-9][0-9]{9}" title="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {stopSelect(`Pickup point (${trip.fromCity})`, pickupStops, pickup, setPickup)}
          {stopSelect(`Drop point (${trip.toCity})`, dropStops, drop, setDrop)}
        </div>

        <PaymentChoice value={payment} onChange={setPayment} allowCash={allowCash} />

        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span>Seats</span>
            <b>{selected.length ? selected.join(", ") : "—"}</b>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Fare ({selected.length} × {inr(trip.fare)})</span>
            <span>{inr(base)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>GST (5%)</span>
            <span>{inr(tax)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
            <span>Total</span>
            <span>{inr(base + tax)}</span>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button className="btn-accent w-full py-3 text-base" disabled={!selected.length || busy}>
          {busy ? "Booking your seats…" : !user ? "Login to continue" : payment === "CASH" ? "Confirm booking" : "Proceed to pay"}
        </button>
        <p className="text-center text-xs text-slate-400">
          {payment === "CASH" ? "Your seats are confirmed now. Pay the driver when you board." : "Seats are held for 10 minutes while you pay."}
        </p>
      </form>
    </div>
  );
}
