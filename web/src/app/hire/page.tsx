import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CircleAlert, Users } from "lucide-react";
import { CallIcon } from "@/components/BrandIcons";
import { db } from "@/lib/db";
import { quoteRental } from "@/lib/booking";
import { HttpError } from "@/lib/http";
import { parseHireParams, toQuery } from "@/lib/hire-params";
import { fmtDateTime, inr, RENTAL_TYPES, VEHICLE_TYPES } from "@/lib/format";
import { EMPTY_ROAD_IMAGE } from "@/lib/media";
import VehicleImage from "@/components/VehicleImage";
import Amenities from "@/components/Amenities";
import ModifyBar from "@/components/ModifyBar";

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
  const routes = await db.route.findMany({ select: { fromCity: true, toCity: true } });
  const cities = [...new Set(routes.flatMap((r) => [r.fromCity, r.toCity]))].sort();
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "";

  return (
    <div className="pb-12">
      <ModifyBar
        title={
          <>
            {req.pickupCity}
            {hasDrop && req.dropCity ? (
              <>
                {" "}
                <span className="text-slate-400">→</span> {req.dropCity}
              </>
            ) : null}
          </>
        }
        subtitle={`${RENTAL_TYPES[req.rentalType]} · Pickup ${fmtDateTime(req.startAt)}${req.returnAt && req.rentalType === "ROUND_TRIP" ? ` · Return ${fmtDateTime(req.returnAt)}` : ""}${quote ? ` · approx. ${quote.plan.estimatedKm} km` : ""}`}
        cities={cities}
        initialTab="hire"
        initial={{ from: req.pickupCity, to: req.dropCity, hireType: req.rentalType, start: sp.start, ret: sp.return }}
      />

      <div className="container-x mt-6">
        {error ? (
          <div className="card grid overflow-hidden md:grid-cols-[1fr_1.1fr]">
            <div className="relative aspect-[16/10] md:aspect-auto">
              <Image src={EMPTY_ROAD_IMAGE} alt="An empty road" fill sizes="(min-width: 768px) 480px, 100vw" className="object-cover" />
            </div>
            <div className="p-8 sm:p-10">
              <CircleAlert className="h-8 w-8 text-accent" aria-hidden />
              <h2 className="mt-3 text-xl font-extrabold text-ink">{error}</h2>
              <p className="mt-2 text-slate-500">Call us and we will sort it out, or change your search.</p>
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn-primary mt-6">
                  <CallIcon className="h-4 w-4" /> Call {phone}
                </a>
              )}
            </div>
          </div>
        ) : !quote || quote.results.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">No vehicles are available for hire right now.</div>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">
              <b className="text-ink">{quote.results.filter((r) => r.available).length}</b> of {quote.results.length} vehicles available · totals include the driver and 5% GST
            </p>
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {quote.results.map(({ vehicle: v, available, baseAmount, taxAmount, totalAmount, billableKm, toll, parking, driverAllowance }) => (
                <li key={v.id} className={`card flex flex-col overflow-hidden ${available ? "card-hover" : "opacity-60"}`}>
                  <div className="relative">
                    <VehicleImage vehicle={v} className="aspect-[16/10]" />
                    {!available && <span className="badge absolute top-3 left-3 bg-red-600 text-white">Not available</span>}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-ink">{v.name}</h2>
                        <p className="text-sm text-slate-500">{VEHICLE_TYPES[v.type] ?? v.type}</p>
                      </div>
                      <span className="chip shrink-0">
                        <Users className="h-3.5 w-3.5 text-brand" aria-hidden /> {v.seats} + driver
                      </span>
                    </div>
                    <div className="mt-3">
                      <Amenities items={v.amenities} />
                    </div>
                    <dl className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">
                          Fare ({billableKm} km{driverAllowance ? `, incl. driver allowance ${inr(driverAllowance)}` : ""})
                        </dt>
                        <dd className="font-semibold text-ink">{inr(baseAmount)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">GST (5%)</dt>
                        <dd className="font-semibold text-ink">{inr(taxAmount)}</dd>
                      </div>
                      {toll > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Toll (estimated)</dt>
                          <dd className="font-semibold text-ink">{inr(toll)}</dd>
                        </div>
                      )}
                      {parking > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Parking</dt>
                          <dd className="font-semibold text-ink">{inr(parking)}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                      <div>
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-2xl font-extrabold text-ink">{inr(totalAmount)}</p>
                      </div>
                      {available ? (
                        <Link href={`/hire/book?${toQuery({ ...sp, vehicle: v.id })}`} className="btn-accent px-5">
                          Select <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-red-600">Not available</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-400">State entry tax, if any, is extra.</p>
          </>
        )}
      </div>
    </div>
  );
}
