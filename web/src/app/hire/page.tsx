import Link from "next/link";
import { notFound } from "next/navigation";
import { quoteRental } from "@/lib/booking";
import { HttpError } from "@/lib/http";
import { parseHireParams, toQuery } from "@/lib/hire-params";
import { fmtDateTime, inr, RENTAL_TYPES, VEHICLE_TYPES } from "@/lib/format";
import VehicleImage from "@/components/VehicleImage";

export const metadata = { title: "Hire a vehicle" };

export default async function HirePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const req = parseHireParams(sp);
  if (!req) notFound();
  const hasDrop = req.rentalType === "ONE_WAY" || req.rentalType === "ROUND_TRIP";

  let quote: Awaited<ReturnType<typeof quoteRental>> | null = null;
  let error = "";
  try {
    quote = await quoteRental(req);
  } catch (e) {
    if (e instanceof HttpError) error = e.message;
    else throw e;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-xl font-bold">
            {RENTAL_TYPES[req.rentalType]} · {req.pickupCity}
            {hasDrop && req.dropCity ? ` → ${req.dropCity}` : ""}
          </h1>
          <p className="text-sm text-slate-500">
            Pickup {fmtDateTime(req.startAt)}
            {req.returnAt && req.rentalType === "ROUND_TRIP" ? ` · Return ${fmtDateTime(req.returnAt)}` : ""}
            {quote ? ` · approx. ${quote.plan.estimatedKm} km` : ""}
          </p>
        </div>
        <Link href="/?tab=hire" className="btn-ghost">Modify search</Link>
      </div>

      {error ? (
        <div className="card p-10 text-center">
          <p className="text-5xl">📞</p>
          <p className="mt-3 text-lg font-bold">{error}</p>
          <p className="text-slate-500">Call {process.env.NEXT_PUBLIC_SUPPORT_PHONE} and we will sort it out.</p>
        </div>
      ) : !quote || quote.results.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">No vehicles are available for hire right now.</div>
      ) : (
        <div className="space-y-3">
          {quote.results.map(({ vehicle: v, available, baseAmount, taxAmount, totalAmount, billableKm, toll, parking, driverAllowance }) => (
            <div key={v.id} className={`card grid gap-4 p-5 sm:grid-cols-[120px_1fr_auto] sm:items-center ${available ? "" : "opacity-60"}`}>
              <VehicleImage vehicle={v} className="h-24 rounded-lg text-5xl" />
              <div>
                <p className="text-lg font-bold">{v.name}</p>
                <p className="text-sm text-slate-500">
                  {VEHICLE_TYPES[v.type] ?? v.type} · {v.seats} seats + driver
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {v.amenities.map((a) => (
                    <span key={a} className="badge bg-slate-100 text-slate-600">{a}</span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {inr(baseAmount)} fare ({billableKm} km{driverAllowance ? `, incl. driver allowance ${inr(driverAllowance)}` : ""}) + {inr(taxAmount)} GST
                  {toll ? ` + ${inr(toll)} toll` : ""}
                  {parking ? ` + ${inr(parking)} parking` : ""}. State entry tax, if any, extra.
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold">{inr(totalAmount)}</p>
                {available ? (
                  <Link href={`/hire/book?${toQuery({ ...sp, vehicle: v.id })}`} className="btn-accent mt-2">Select</Link>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-red-600">Not available</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
