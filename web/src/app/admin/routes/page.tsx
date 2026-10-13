import { db } from "@/lib/db";
import { fmtDuration, inr } from "@/lib/format";
import Flash from "@/components/Flash";
import { addRoute, deleteRoute } from "../actions";

export default async function RoutesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const routes = await db.route.findMany({ orderBy: [{ fromCity: "asc" }, { toCity: "asc" }], include: { _count: { select: { trips: true } } } });

  return (
    <div className="space-y-4">
      <h1 className="page-title">Routes &amp; fares</h1>
      <p className="text-sm text-slate-500">
        Routes set the distance, travel time, toll and parking between two cities. They are used for scheduled shared trips and to price
        one-way and round-trip full cabs. Adding an existing route again updates it.
      </p>
      <Flash error={error} />

      <form action={addRoute} className="card grid gap-3 p-4 sm:grid-cols-4 lg:grid-cols-8 lg:items-end">
        <div className="lg:col-span-1">
          <label className="label">From</label>
          <input name="fromCity" className="input" required placeholder="Khatima" />
        </div>
        <div className="lg:col-span-1">
          <label className="label">To</label>
          <input name="toCity" className="input" required placeholder="Delhi" />
        </div>
        <div>
          <label className="label">Distance (km)</label>
          <input name="distanceKm" type="number" min={1} className="input" required />
        </div>
        <div>
          <label className="label">Time (hours)</label>
          <input name="durationHours" type="number" min={0.5} step={0.25} className="input" required />
        </div>
        <div>
          <label className="label">Toll, car (₹)</label>
          <input name="tollAmount" type="number" min={0} defaultValue={0} className="input" />
        </div>
        <div>
          <label className="label">Parking (₹)</label>
          <input name="parkingAmount" type="number" min={0} defaultValue={0} className="input" />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="bothWays" defaultChecked className="accent-brand" /> Both ways
        </label>
        <button className="btn-primary">Add / update</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Distance</th>
              <th>Time</th>
              <th>Toll (car, one way)</th>
              <th>Parking</th>
              <th>Trips</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">
                  {r.fromCity} → {r.toCity}
                </td>
                <td>{r.distanceKm} km</td>
                <td>{fmtDuration(r.durationMins)}</td>
                <td>{inr(r.tollAmount)}</td>
                <td>{inr(r.parkingAmount)}</td>
                <td>{r._count.trips}</td>
                <td>
                  {r._count.trips === 0 && (
                    <form action={deleteRoute}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-sm font-semibold text-red-600">Delete</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
