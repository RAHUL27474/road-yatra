import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarFront, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { searchTrips } from "@/lib/trips";
import { EMPTY_ROAD_IMAGE, tomorrowMorning } from "@/lib/media";
import ModifyBar from "@/components/ModifyBar";
import TripResults from "./TripResults";

export const metadata = { title: "Search results" };

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00+05:30`);
  return new Date(d.getTime() + days * 24 * 3600_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { from, to, date } = await searchParams;
  if (!from || !to || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const [trips, routes] = await Promise.all([searchTrips(from, to, date), db.route.findMany({ select: { fromCity: true, toCity: true } })]);
  const cities = [...new Set(routes.flatMap((r) => [r.fromCity, r.toCity]))].sort();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const start = shiftDate(date, -3) < today ? today : shiftDate(date, -3);
  const days = Array.from({ length: 7 }, (_, n) => shiftDate(start, n));
  const dateLabel = new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "";
  const hireHref = `/hire?${new URLSearchParams({ type: "ONE_WAY", pickup: from, drop: to, start: date > today ? `${date}T09:00` : tomorrowMorning() })}`;

  return (
    <div className="pb-12">
      <ModifyBar
        title={
          <>
            {from} <span className="text-slate-400">→</span> {to}
          </>
        }
        subtitle={`${dateLabel} · ${trips.length} departure${trips.length === 1 ? "" : "s"} · Shared seat`}
        cities={cities}
        initialTab="seats"
        initial={{ from, to, date }}
      />

      <div className="container-x">
        <nav className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Choose date">
          {days.map((d) => {
            const dt = new Date(`${d}T12:00:00+05:30`);
            const active = d === date;
            return (
              <Link
                key={d}
                href={`/search?${new URLSearchParams({ from, to, date: d })}`}
                aria-current={active ? "date" : undefined}
                className={`flex min-w-[84px] shrink-0 flex-col items-center rounded-xl px-3 py-2 text-center transition sm:flex-1 ${
                  active ? "bg-brand text-white shadow-md shadow-brand/25" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand/50"
                }`}
              >
                <span className={`text-[11px] font-semibold uppercase ${active ? "text-blue-100" : "text-slate-400"}`}>
                  {d === today ? "Today" : dt.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span className="text-sm font-bold">{dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              </Link>
            );
          })}
        </nav>

        {trips.length === 0 ? (
          <div className="card mt-6 grid overflow-hidden md:grid-cols-[1fr_1.1fr]">
            <div className="relative aspect-[16/10] md:aspect-auto">
              <Image src={EMPTY_ROAD_IMAGE} alt="An empty road" fill sizes="(min-width: 768px) 480px, 100vw" className="object-cover" />
            </div>
            <div className="p-8 sm:p-10">
              <h2 className="text-xl font-extrabold text-ink">No shared departures on this date</h2>
              <p className="mt-2 text-slate-500">
                Try another date from the strip above, or hire a whole cab for {from} to {to} at a time that suits you.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={hireHref} className="btn-accent">
                  <CarFront className="h-4 w-4" aria-hidden /> See full cab fares
                </Link>
                {phone && (
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn-ghost">
                    <Phone className="h-4 w-4" aria-hidden /> Call {phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          <TripResults
            trips={trips.map((t) => ({ ...t, departAt: t.departAt.toISOString(), arriveAt: t.arriveAt.toISOString() }))}
          />
        )}
      </div>
    </div>
  );
}
