import Link from "next/link";
import { db } from "@/lib/db";
import { inr, VEHICLE_TYPES } from "@/lib/format";
import SearchBox from "@/components/SearchBox";
import VehicleImage from "@/components/VehicleImage";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [routes, vehicles] = await Promise.all([
    db.route.findMany({ orderBy: { distanceKm: "asc" } }),
    db.vehicle.findMany({ where: { active: true }, orderBy: { seats: "asc" } }),
  ]);
  const cities = [...new Set(routes.flatMap((r) => [r.fromCity, r.toCity]))].sort();
  const popular = routes.filter((r) => r.fromCity === "Khatima" || r.toCity === "Khatima").slice(0, 6);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  return (
    <>
      <section className="bg-gradient-to-br from-brand-dark via-brand to-sky-500 pb-24 pt-10 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Khatima se Delhi – Seat bhi book karein, Puri Cab bhi.</h1>
          <p className="mt-2 text-lg text-blue-100">Affordable shared taxi on fixed daily departures, or a reliable full cab for your family. Own vehicles, verified drivers, live tracking.</p>
        </div>
      </section>

      <section className="mx-auto -mt-14 max-w-6xl px-4">
        <SearchBox cities={cities} initialTab={tab === "hire" ? "hire" : "seats"} />
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["✅", "Verified drivers", "Our own trained drivers, with boarding OTP and live trip tracking."],
            ["💰", "Transparent pricing", "All-inclusive fares with GST shown upfront. No hidden charges."],
            ["🕑", "24×7 support", `Call us any time on ${process.env.NEXT_PUBLIC_SUPPORT_PHONE}.`],
          ].map(([icon, title, text]) => (
            <div key={title} className="card flex gap-4 p-5">
              <span className="text-3xl">{icon}</span>
              <div>
                <h3 className="font-bold">{title}</h3>
                <p className="text-sm text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {popular.length > 0 && (
        <section className="mx-auto mt-12 max-w-6xl px-4">
          <h2 className="mb-4 text-2xl font-bold">Popular routes</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((r) => (
              <Link
                key={r.id}
                href={`/search?${new URLSearchParams({ from: r.fromCity, to: r.toCity, date: today })}`}
                className="card flex items-center justify-between p-4 transition hover:shadow-md hover:ring-brand"
              >
                <div>
                  <p className="font-bold">
                    {r.fromCity} → {r.toCity}
                  </p>
                  <p className="text-sm text-slate-500">{r.distanceKm} km</p>
                </div>
                <span className="text-brand">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {vehicles.length > 0 && (
        <section className="mx-auto mt-12 max-w-6xl px-4">
          <h2 className="mb-4 text-2xl font-bold">Our fleet</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => (
              <div key={v.id} className="card overflow-hidden">
                <VehicleImage vehicle={v} className="h-36 text-6xl" />
                <div className="p-4">
                  <p className="font-bold">{v.name}</p>
                  <p className="text-sm text-slate-500">
                    {VEHICLE_TYPES[v.type] ?? v.type} · {v.seats} seats
                  </p>
                  <p className="mt-2 text-sm">
                    {v.allowRental && (
                      <>
                        From <b>{inr(v.ratePerKm)}/km</b>
                      </>
                    )}
                    {v.allowRental && v.allowSeatBooking && " · "}
                    {v.allowSeatBooking && <span className="badge bg-green-100 text-green-700">Seat booking</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
