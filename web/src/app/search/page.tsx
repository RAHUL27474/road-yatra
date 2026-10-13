import Link from "next/link";
import { notFound } from "next/navigation";
import { searchTrips } from "@/lib/trips";
import { fmtDuration, fmtTime, inr, VEHICLE_TYPES } from "@/lib/format";

export const metadata = { title: "Search results" };

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00+05:30`);
  return new Date(d.getTime() + days * 24 * 3600_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { from, to, date } = await searchParams;
  if (!from || !to || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const trips = await searchTrips(from, to, date);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const days = [-2, -1, 0, 1, 2, 3, 4].map((n) => shiftDate(date, n)).filter((d) => d >= today);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-xl font-bold">
            {from} → {to}
          </h1>
          <p className="text-sm text-slate-500">{trips.length} trip(s) found</p>
        </div>
        <Link href="/" className="btn-ghost">Modify search</Link>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const label = new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
          return (
            <Link
              key={d}
              href={`/search?${new URLSearchParams({ from, to, date: d })}`}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${d === date ? "bg-brand text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {trips.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-5xl">🛣️</p>
          <p className="mt-3 text-lg font-bold">No trips on this date</p>
          <p className="text-slate-500">Try another date, or hire a whole vehicle for your trip instead.</p>
          <Link href="/?tab=hire" className="btn-primary mt-4">Hire a vehicle</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((t) => (
            <div key={t.id} className="card grid gap-4 p-5 sm:grid-cols-[1.4fr_2fr_1fr] sm:items-center">
              <div>
                <p className="font-bold">{t.vehicle.name}</p>
                <p className="text-sm text-slate-500">{VEHICLE_TYPES[t.vehicle.type] ?? t.vehicle.type}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.vehicle.amenities.map((a) => (
                    <span key={a} className="badge bg-slate-100 text-slate-600">{a}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-2xl font-bold">{fmtTime(t.departAt)}</p>
                  <p className="max-w-36 text-xs text-slate-500">{t.fromCity}</p>
                </div>
                <div className="flex-1 text-center text-xs text-slate-500">
                  <div className="border-t border-dashed border-slate-300" />
                  <span className="relative -top-2 bg-white px-2">{fmtDuration(t.durationMins)}</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{fmtTime(t.arriveAt)}</p>
                  <p className="max-w-36 text-xs text-slate-500">{t.toCity}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                <div className="sm:text-right">
                  <p className="text-2xl font-extrabold">{inr(t.fare)}</p>
                  <p className={`text-xs font-semibold ${t.seatsLeft <= 3 ? "text-red-600" : "text-green-700"}`}>
                    {t.seatsLeft > 0 ? `${t.seatsLeft} seats left` : "Sold out"}
                  </p>
                </div>
                {t.seatsLeft > 0 ? (
                  <Link href={`/trip/${t.id}`} className="btn-accent">Select seats</Link>
                ) : (
                  <span className="btn-ghost pointer-events-none opacity-50">Sold out</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
