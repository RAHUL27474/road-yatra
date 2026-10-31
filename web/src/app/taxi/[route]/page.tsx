import Link from "next/link";
import { notFound } from "next/navigation";
import { Armchair, CarFront, Clock, IndianRupee, MapPin } from "lucide-react";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { db } from "@/lib/db";
import { priceRental } from "@/lib/booking";
import { fmtDate, fmtDuration, fmtTime, inr, ymd } from "@/lib/format";
import { tomorrowMorning, whatsappLink } from "@/lib/media";
import { routeFromSlug } from "@/lib/route-pages";
import { isOffIn, offPairs } from "@/lib/fleet";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ route: string }> };

const brand = () => process.env.NEXT_PUBLIC_BRAND_NAME || "Jai Shree Shyam Tour & Travels";

export async function generateMetadata({ params }: Params) {
  const r = await routeFromSlug((await params).route);
  if (!r) return { title: "Route not found" };
  return {
    title: `${r.fromCity} to ${r.toCity} taxi — shared seat & full cab`,
    description: `${r.fromCity} to ${r.toCity} (${r.distanceKm} km, about ${fmtDuration(r.durationMins)}): book a shared taxi seat or a full cab with ${brand()}. Pick your seat, pay cash to the driver, live tracking.`,
  };
}

/** Public page per route ("Khatima to Delhi taxi"): what people search for, with fares and the next departures. */
export default async function RoutePage({ params }: Params) {
  const r = await routeFromSlug((await params).route);
  if (!r) notFound();

  const [allTrips, allVehicles, pickups, drops] = await Promise.all([
    db.trip.findMany({
      where: { routeId: r.id, status: "SCHEDULED", departAt: { gt: new Date() } },
      include: { vehicle: true, _count: { select: { seats: true } } },
      orderBy: { departAt: "asc" },
      take: 6,
    }),
    db.vehicle.findMany({ where: { active: true, allowRental: true }, orderBy: { seats: "asc" } }),
    db.stop.findMany({ where: { city: r.fromCity, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.stop.findMany({ where: { city: r.toCity, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  // Vehicles the office switched off on this route are not shown (Admin → Fleet on routes).
  const off = await offPairs();
  const reverse = await db.route.findFirst({ where: { fromCity: r.toCity, toCity: r.fromCity }, select: { id: true } });
  const trips = allTrips.filter((t) => !isOffIn(off, r.id, t.vehicleId));
  const vehicles = allVehicles.filter((v) => !isOffIn(off, r.id, v.id) && !(reverse && isOffIn(off, reverse.id, v.id)));
  const lowestSeat = trips.length ? Math.min(...trips.map((t) => t.fare)) : null;
  // One-way full-cab estimate per vehicle, priced exactly like the hire form (tolls included, GST extra).
  const start = new Date(Date.now() + 24 * 3600_000);
  const plan = { km: r.distanceKm, days: Math.max(1, Math.ceil(r.distanceKm / 500)), startAt: start, endAt: new Date(start.getTime() + r.durationMins * 2 * 60_000), route: r };
  const cabs = vehicles.map((v) => ({ v, price: priceRental(v, "ONE_WAY", plan) }));
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "";
  const searchHref = `/search?${new URLSearchParams({ from: r.fromCity, to: r.toCity, date: ymd(trips[0]?.departAt ?? start) })}`;

  return (
    <div className="container-x max-w-4xl space-y-6 py-10">
      <div>
        <h1 className="page-title">
          {r.fromCity} to {r.toCity} taxi
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4 text-brand" aria-hidden /> {r.distanceKm} km
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-brand" aria-hidden /> about {fmtDuration(r.durationMins)}
          </span>
          {lowestSeat != null && (
            <span className="flex items-center gap-1">
              <IndianRupee className="h-4 w-4 text-brand" aria-hidden /> shared seat from {inr(lowestSeat)}
            </span>
          )}
        </p>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <Armchair className="h-5 w-5 text-brand" aria-hidden /> Shared taxi — next departures
        </h2>
        {trips.length === 0 ? (
          <p className="text-sm text-slate-500">No shared departures scheduled right now. Book a full cab below, or message us on WhatsApp.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {trips.map((t) => {
              const left = t.vehicle.seats - t._count.seats;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-semibold">
                      {fmtDate(t.departAt)} · {fmtTime(t.departAt)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.vehicle.name} · {left > 0 ? `${left} seat${left > 1 ? "s" : ""} left` : "full"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{inr(t.fare)}</span>
                    {left > 0 && (
                      <Link href={`/trip/${t.id}`} className="btn-primary px-3 py-1.5 text-sm">
                        Pick seat
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {trips.length > 0 && (
          <Link href={searchHref} className="mt-3 inline-block text-sm font-semibold text-brand">
            See all dates →
          </Link>
        )}
      </section>

      {cabs.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <CarFront className="h-5 w-5 text-brand" aria-hidden /> Full cab, one way
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {cabs.map(({ v, price }) => (
              <li key={v.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-semibold">{v.name}</p>
                <p className="text-xs text-slate-500">{v.seats} passengers</p>
                <p className="mt-1 text-lg font-extrabold">{inr(price.baseAmount + price.extraCharges)}</p>
                <p className="text-[11px] text-slate-500">incl. tolls &amp; driver allowance, + GST</p>
              </li>
            ))}
          </ul>
          <Link
            href={`/hire?${new URLSearchParams({ type: "ONE_WAY", pickup: r.fromCity, drop: r.toCity, start: tomorrowMorning() })}`}
            className="btn-primary mt-4 inline-block"
          >
            Book a full cab
          </Link>
        </section>
      )}

      {(pickups.length > 0 || drops.length > 0) && (
        <section className="card grid gap-4 p-5 text-sm sm:grid-cols-2">
          {[
            [`Pickup points in ${r.fromCity}`, pickups],
            [`Drop points in ${r.toCity}`, drops],
          ].map(([title, list]) => (
            <div key={title as string}>
              <h2 className="mb-2 font-bold">{title as string}</h2>
              <ul className="space-y-1.5">
                {(list as typeof pickups).map((s) => (
                  <li key={s.id}>
                    <span className="font-medium">{s.name}</span>
                    {s.landmark ? <span className="block text-xs text-amber-700">{s.landmark}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {phone && (
        <a
          href={`${whatsappLink(phone)}?text=${encodeURIComponent(`Namaste, I want to book ${r.fromCity} to ${r.toCity}.\nDate: \nSeats / people: `)}`}
          className="card flex items-center gap-3 p-4 hover:shadow-md"
        >
          <WhatsAppIcon className="h-6 w-6 text-[#25D366]" />
          <span className="flex-1">
            <span className="block font-bold">Book on WhatsApp</span>
            <span className="text-sm text-slate-500">Send your date and number of seats — we reply with availability.</span>
          </span>
        </a>
      )}
    </div>
  );
}
