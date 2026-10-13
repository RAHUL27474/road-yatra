import Link from "next/link";
import { db } from "@/lib/db";
import { RENTAL_TYPES } from "@/lib/format";
import Flash from "@/components/Flash";
import { offlineRentalBooking } from "../../actions";

/** Office entry form for full-cab bookings taken by phone or at the counter. */
export default async function NewPhoneBooking({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [vehicles, routes] = await Promise.all([
    db.vehicle.findMany({ where: { active: true, allowRental: true }, orderBy: { seats: "asc" } }),
    db.route.findMany({ select: { fromCity: true, toCity: true } }),
  ]);
  const cities = [...new Set(routes.flatMap((r) => [r.fromCity, r.toCity]))].sort();

  return (
    <form action={offlineRentalBooking} className="space-y-4">
      <h1 className="text-2xl font-bold">New phone booking — full cab</h1>
      <p className="text-sm text-slate-500">
        For shared seats, open the trip in <Link href="/admin/trips" className="font-semibold text-brand">Trips &amp; schedule</Link> and use
        &quot;Phone / walk-in booking&quot;. The fare is calculated automatically from the vehicle&apos;s rates. The booking is confirmed straight
        away, and the customer gets an SMS/WhatsApp confirmation.
      </p>
      <Flash error={error} />

      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <label className="label">Trip type</label>
          <select name="rentalType" className="input">
            {Object.entries(RENTAL_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Pickup city</label>
          <select name="pickupCity" className="input" defaultValue="Khatima">
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Drop city (one way / round trip)</label>
          <select name="dropCity" className="input" defaultValue="Delhi">
            <option value="">—</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Pickup date &amp; time</label>
          <input name="startAt" type="datetime-local" className="input" required />
        </div>
        <div>
          <label className="label">Return (round trip only)</label>
          <input name="returnAt" type="datetime-local" className="input" />
        </div>
        <div>
          <label className="label">Vehicle</label>
          <select name="vehicleId" className="input" required>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.regNumber} · {v.seats} seats
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <label className="label">Customer name</label>
          <input name="passengerName" className="input" required />
        </div>
        <div>
          <label className="label">Mobile number</label>
          <input name="passengerPhone" className="input" required inputMode="numeric" pattern="[6-9][0-9]{9}" />
        </div>
        <div>
          <label className="label">Passengers</label>
          <input name="passengers" type="number" min={1} defaultValue={1} className="input" />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Pickup address</label>
          <input name="pickupAddress" className="input" required minLength={5} />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Drop address (optional)</label>
          <input name="dropAddress" className="input" />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" name="paid" className="accent-brand" /> Already paid (advance received at office)
        </label>
      </section>
      <button className="btn-primary px-8 py-3">Create booking</button>
    </form>
  );
}
