import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, ChevronLeft, CircleDot, Flag, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { planRental, priceRental, publicVehicle } from "@/lib/booking";
import { HttpError } from "@/lib/http";
import { parseHireParams, toQuery } from "@/lib/hire-params";
import { fmtDateTime, inr, RENTAL_TYPES, VEHICLE_TYPES } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { onlinePaymentsAvailable } from "@/lib/payment-mode";
import VehicleImage from "@/components/VehicleImage";
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
    <div className="container-x py-6">
      <Link href={`/hire?${toQuery(sp, ["vehicle"])}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Back to vehicles
      </Link>
      <h1 className="page-title mt-2 mb-5">Review & book your cab</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <RentalForm
          request={{ ...req, startAt: req.startAt.toISOString(), returnAt: req.returnAt?.toISOString() }}
          vehicle={publicVehicle(vehicle)}
          user={{ name: user.name, phone: user.phone }}
          allowCash={(await getSettings()).allowCash}
          allowOnline={onlinePaymentsAvailable()}
        />
        <aside className="h-fit lg:sticky lg:top-24">
          <div className="card overflow-hidden text-sm">
            <VehicleImage vehicle={vehicle} className="aspect-[16/9]" sizes="360px" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">{vehicle.name}</h2>
                  <p className="text-slate-500">
                    {VEHICLE_TYPES[vehicle.type] ?? vehicle.type} · {RENTAL_TYPES[req.rentalType]}
                  </p>
                </div>
                <span className="chip shrink-0">
                  <Users className="h-3.5 w-3.5 text-brand" aria-hidden /> {vehicle.seats}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <p className="flex gap-2">
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden /> {req.pickupCity}
                </p>
                {hasDrop && (
                  <p className="flex gap-2">
                    <Flag className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden /> {req.dropCity}
                  </p>
                )}
                <p className="flex gap-2 text-slate-600">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> Pickup: {fmtDateTime(plan.startAt)}
                </p>
                {req.rentalType === "ROUND_TRIP" && req.returnAt && (
                  <p className="flex gap-2 text-slate-600">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> Return: {fmtDateTime(req.returnAt)}
                  </p>
                )}
              </div>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Base fare ({price.billableKm} km)</span>
                  <span>{inr(price.baseAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">GST (5%)</span>
                  <span>{inr(price.taxAmount)}</span>
                </div>
                {price.toll > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Toll (estimated)</span>
                    <span>{inr(price.toll)}</span>
                  </div>
                )}
                {price.parking > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Parking</span>
                    <span>{inr(price.parking)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-extrabold text-ink">
                  <span>Total</span>
                  <span>{inr(price.totalAmount)}</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Toll is an estimate; state entry tax, if any, is paid on actuals. Extra km beyond the included distance is charged at {inr(vehicle.ratePerKm)}/km.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
