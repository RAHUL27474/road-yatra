"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PaymentChoice, { type Payment } from "@/components/PaymentChoice";
import { apiFetch, payPath } from "@/lib/client";

type Props = {
  request: { rentalType: string; pickupCity: string; dropCity?: string; startAt: string; returnAt?: string };
  vehicle: { id: string; name: string; seats: number };
  user: { name: string; phone: string };
  allowCash: boolean;
};

export default function RentalForm({ request, vehicle, user, allowCash }: Props) {
  const router = useRouter();
  const hasDrop = request.rentalType === "ONE_WAY" || request.rentalType === "ROUND_TRIP";
  const [form, setForm] = useState({ passengerName: user.name, passengerPhone: user.phone, passengers: 1, pickupAddress: "", dropAddress: "" });
  const [payment, setPayment] = useState<Payment>("ONLINE");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: k === "passengers" ? Number(e.target.value) : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch<{ payUrl: string | null; booking: { code: string } }>("/api/bookings", {
        body: { kind: "RENTAL", vehicleId: vehicle.id, ...request, ...form, payment },
      });
      router.push(res.payUrl ? payPath(res.payUrl) : `/booking/${res.booking.code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h1 className="text-xl font-bold">Traveller details</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Full name</label>
          <input className="input" required value={form.passengerName} onChange={set("passengerName")} />
        </div>
        <div>
          <label className="label">Mobile number</label>
          <input className="input" required inputMode="numeric" pattern="[6-9][0-9]{9}" title="10-digit mobile number" value={form.passengerPhone} onChange={set("passengerPhone")} />
        </div>
        <div>
          <label className="label">Passengers</label>
          <select className="input" value={form.passengers} onChange={set("passengers")}>
            {Array.from({ length: vehicle.seats }, (_, i) => i + 1).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Pickup address in {request.pickupCity}</label>
        <textarea className="input" rows={2} required minLength={5} placeholder="House no., street, landmark, area" value={form.pickupAddress} onChange={set("pickupAddress")} />
      </div>
      {hasDrop && (
        <div>
          <label className="label">Drop address in {request.dropCity} (optional)</label>
          <textarea className="input" rows={2} placeholder="e.g. Anand Vihar ISBT, or full address" value={form.dropAddress} onChange={set("dropAddress")} />
        </div>
      )}
      <PaymentChoice value={payment} onChange={setPayment} allowCash={allowCash} />
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-accent w-full py-3 text-base" disabled={busy}>
        {busy ? "Reserving vehicle…" : payment === "CASH" ? "Confirm booking" : "Proceed to pay"}
      </button>
      <p className="text-center text-xs text-slate-400">
        {payment === "CASH" ? "Your cab is confirmed now. Pay the driver in cash." : "The vehicle is held for 10 minutes while you pay."}
      </p>
    </form>
  );
}
