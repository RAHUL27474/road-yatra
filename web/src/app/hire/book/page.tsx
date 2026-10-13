import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { planRental, priceRental, publicVehicle } from "@/lib/booking";
import { HttpError } from "@/lib/http";
import { parseHireParams, toQuery } from "@/lib/hire-params";
import { fmtDateTime, inr, RENTAL_TYPES } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import RentalForm from "./RentalForm";

export const metadata = { title: "Review & book" };

export default async function HireBookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const req = parseHireParams(sp);
  if (!req || !sp.vehicle) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/hire/book?${toQuery(sp)}`)}`);

  const vehicle = await db.vehicle.findUnique({ where: { id: sp.vehicle } });
  if (!vehicle) notFound();
  let plan;
  try {
    plan = await planRental(req);
  } catch (e) {
    if (e instanceof HttpError) redirect(`/hire?${toQuery(sp, ["vehicle"])}`);
    throw e;
  }
  const price = priceRental(vehicle, req.rentalType, plan);
  const hasDrop = req.rentalType === "ONE_WAY" || req.rentalType === "ROUND_TRIP";

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 md:grid-cols-[1fr_340px]">
      <RentalForm
        request={{ ...req, startAt: req.startAt.toISOString(), returnAt: req.returnAt?.toISOString() }}
        vehicle={publicVehicle(vehicle)}
        user={{ name: user.name, phone: user.phone }}
        allowCash={(await getSettings()).allowCash}
      />
      <aside className="card h-fit p-5 text-sm">
        <h2 className="mb-3 text-base font-bold">Trip summary</h2>
        <p className="font-semibold">{vehicle.name}</p>
        <p className="text-slate-500">{RENTAL_TYPES[req.rentalType]}</p>
        <p className="mt-2">
          {req.pickupCity}
          {hasDrop ? ` → ${req.dropCity}` : ""}
        </p>
        <p className="text-slate-500">Pickup: {fmtDateTime(plan.startAt)}</p>
        {req.rentalType === "ROUND_TRIP" && req.returnAt && <p className="text-slate-500">Return: {fmtDateTime(req.returnAt)}</p>}
        <div className="mt-4 space-y-1 border-t border-slate-200 pt-3">
          <div className="flex justify-between">
            <span>Base fare ({price.billableKm} km)</span>
            <span>{inr(price.baseAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST (5%)</span>
            <span>{inr(price.taxAmount)}</span>
          </div>
          {price.toll > 0 && (
            <div className="flex justify-between">
              <span>Toll (estimated)</span>
              <span>{inr(price.toll)}</span>
            </div>
          )}
          {price.parking > 0 && (
            <div className="flex justify-between">
              <span>Parking</span>
              <span>{inr(price.parking)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
            <span>Total</span>
            <span>{inr(price.totalAmount)}</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Toll is an estimate; state entry tax, if any, is paid on actuals. Extra km beyond the included distance is charged at {inr(vehicle.ratePerKm)}/km.
        </p>
      </aside>
    </div>
  );
}
