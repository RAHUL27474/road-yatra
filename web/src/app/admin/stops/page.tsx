import { db } from "@/lib/db";
import Flash from "@/components/Flash";
import { saveStop } from "../actions";

export default async function StopsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [stops, routes] = await Promise.all([
    db.stop.findMany({ orderBy: [{ city: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    db.route.findMany({ select: { fromCity: true, toCity: true } }),
  ]);
  const cities = [...new Set(routes.flatMap((r) => [r.fromCity, r.toCity]))].sort();
  const byCity = cities.map((c) => [c, stops.filter((s) => s.city === c)] as const).filter(([, s]) => s.length);
  const orphan = stops.filter((s) => !cities.includes(s.city));

  return (
    <div className="space-y-4">
      <h1 className="page-title">Pickup &amp; drop points</h1>
      <p className="text-sm text-slate-500">
        Customers booking a shared seat choose one of these points in the departure and arrival city. Coordinates are used for the live-tracking
        map and ETA — copy them from Google Maps (right-click a place → the numbers at the top).
      </p>
      <Flash error={error} />

      <form action={saveStop} className="card grid gap-3 p-4 sm:grid-cols-6 sm:items-end">
        <div>
          <label className="label">City</label>
          <input name="city" className="input" required list="cities" placeholder="Khatima" />
          <datalist id="cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Point name</label>
          <input name="name" className="input" required placeholder="Khatima Bus Stand" />
        </div>
        <div>
          <label className="label">Latitude</label>
          <input name="lat" type="number" step="any" className="input" placeholder="28.9213" />
        </div>
        <div>
          <label className="label">Longitude</label>
          <input name="lng" type="number" step="any" className="input" placeholder="79.9701" />
        </div>
        <button className="btn-primary">Add point</button>
        <div className="sm:col-span-4">
          <label className="label">Address / landmark</label>
          <input name="address" className="input" />
        </div>
        <div>
          <label className="label">Order</label>
          <input name="sortOrder" type="number" defaultValue={0} className="input" />
        </div>
      </form>

      {[...byCity, ...(orphan.length ? [["Other", orphan] as const] : [])].map(([city, list]) => (
        <div key={city} className="card overflow-x-auto">
          <h2 className="border-b border-slate-200 px-4 py-2 font-bold">{city}</h2>
          <table className="table">
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td colSpan={7} className="p-0">
                    <form action={saveStop} className="grid items-center gap-2 px-3 py-2 sm:grid-cols-[2fr_2fr_1fr_1fr_70px_80px_auto]">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="city" value={s.city} />
                      <input name="name" defaultValue={s.name} className="input py-1" />
                      <input name="address" defaultValue={s.address} className="input py-1" placeholder="Address" />
                      <input name="lat" type="number" step="any" defaultValue={s.lat ?? ""} className="input py-1" placeholder="Lat" />
                      <input name="lng" type="number" step="any" defaultValue={s.lng ?? ""} className="input py-1" placeholder="Lng" />
                      <input name="sortOrder" type="number" defaultValue={s.sortOrder} className="input py-1" title="Order" />
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" name="active" defaultChecked={s.active} className="accent-brand" /> Active
                      </label>
                      <button className="btn-ghost py-1">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
