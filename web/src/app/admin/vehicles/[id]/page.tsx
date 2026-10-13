import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { VEHICLE_TYPES, ymd } from "@/lib/format";
import Flash from "@/components/Flash";
import { saveVehicle } from "../../actions";

export default async function VehicleForm({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const v = id === "new" ? null : await db.vehicle.findUnique({ where: { id } });
  if (id !== "new" && !v) notFound();

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" {...props} />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
  const check = (name: string, label: string, checked: boolean) => (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4 accent-brand" />
      {label}
    </label>
  );

  return (
    <form action={saveVehicle} className="space-y-4">
      <h1 className="text-2xl font-bold">{v ? `Edit ${v.name}` : "Add vehicle"}</h1>
      <Flash error={error} />
      <input type="hidden" name="id" value={v?.id ?? ""} />

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Basic details</h2>
        {field("name", "Vehicle name", { required: true, defaultValue: v?.name, placeholder: "Toyota Innova Crysta" })}
        <div>
          <label className="label" htmlFor="type">Type</label>
          <select id="type" name="type" className="input" defaultValue={v?.type ?? "SUV"}>
            {Object.entries(VEHICLE_TYPES).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
        {field("regNumber", "Registration number", { required: true, defaultValue: v?.regNumber, placeholder: "DL01AB1234" })}
        {field("amenities", "Amenities", { defaultValue: v?.amenities, placeholder: "AC,Music,Charging Point" }, "Separate with commas")}
        {field("imageUrl", "Photo URL (optional)", { type: "url", defaultValue: v?.imageUrl ?? "" })}
        <div className="flex flex-col justify-end gap-2">
          {check("active", "Active (bookable)", v?.active ?? true)}
        </div>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <h2 className="font-bold sm:col-span-3">Seats & layout</h2>
        {field("seats", "Passenger seats", { type: "number", min: 1, max: 60, required: true, defaultValue: v?.seats ?? 7 }, "Not counting the driver")}
        {field("seatsPerRow", "Seats per row", { type: "number", min: 1, max: 6, required: true, defaultValue: v?.seatsPerRow ?? 3 }, "Used to draw the seat map")}
        {field("aisleAfter", "Aisle after seat no.", { type: "number", min: 0, max: 5, defaultValue: v?.aisleAfter ?? 0 }, "e.g. 2 for a 2+1 layout, 0 = no aisle")}
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-bold">How customers can book it</h2>
        <div className="flex flex-wrap gap-6">
          {check("allowSeatBooking", "Sell individual seats on scheduled trips", v?.allowSeatBooking ?? false)}
          {check("allowRental", "Hire out the whole vehicle", v?.allowRental ?? true)}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {field("ratePerKm", "Rate per km (₹)", { type: "number", min: 0, step: "0.5", defaultValue: v?.ratePerKm ?? 12 })}
          {field("minKmPerDay", "Min. km per day (round trip)", { type: "number", min: 0, defaultValue: v?.minKmPerDay ?? 250 })}
          {field("driverAllowance", "Driver allowance per day (₹)", { type: "number", min: 0, defaultValue: v?.driverAllowance ?? 300 })}
          {field("localPackage", "Local 8 hr / 80 km package (₹)", { type: "number", min: 0, defaultValue: v?.localPackage ?? 2000 })}
          {field("airportFare", "Airport transfer (₹)", { type: "number", min: 0, defaultValue: v?.airportFare ?? 1200 })}
          {field("tollFactor", "Toll multiplier", { type: "number", min: 0.5, max: 5, step: "0.1", defaultValue: v?.tollFactor ?? 1 }, "1 for cars; ~1.6 for a tempo traveller (LCV toll rate)")}
        </div>
        <p className="text-xs text-slate-400">
          One way = distance × rate + driver allowance. Round trip = max(2 × distance, min km × days) × rate + allowance × days. 5% GST is added on top. Route toll × multiplier and parking are added (no GST) for one-way and round trips.
        </p>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-4">
        <h2 className="font-bold sm:col-span-4">Document expiry dates</h2>
        {field("insuranceExpiry", "Insurance", { type: "date", defaultValue: ymd(v?.insuranceExpiry) })}
        {field("permitExpiry", "Permit", { type: "date", defaultValue: ymd(v?.permitExpiry) })}
        {field("fitnessExpiry", "Fitness", { type: "date", defaultValue: ymd(v?.fitnessExpiry) })}
        {field("pucExpiry", "PUC", { type: "date", defaultValue: ymd(v?.pucExpiry) })}
        <p className="text-xs text-slate-400 sm:col-span-4">The dashboard warns you 30 days before any of these expire.</p>
      </section>

      <button className="btn-primary px-8 py-3">Save vehicle</button>
    </form>
  );
}
