import Link from "next/link";
import { db } from "@/lib/db";
import { fmtTime, inr } from "@/lib/format";
import { isOffIn, offPairs } from "@/lib/fleet";
import { AutoRefresh } from "@/components/AutoRefresh";
import { toggleRouteVehicle } from "../actions";

const LIVE_MIN = 10; // a location newer than this means the vehicle is on the road now

/**
 * Which vehicle runs on which route: an on/off switch per route and vehicle, the next 14 days of shared trips,
 * today's departures, and the vehicles on the road right now (live location).
 */
export default async function FleetPage() {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const dayStart = new Date(`${todayStr}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const until = new Date(now.getTime() + 14 * 24 * 3600_000);

  const [routes, vehicles, trips, off, locations, rentalsNow] = await Promise.all([
    db.route.findMany({ orderBy: [{ fromCity: "asc" }, { toCity: "asc" }] }),
    db.vehicle.findMany({ where: { active: true }, orderBy: [{ allowSeatBooking: "desc" }, { seats: "desc" }, { name: "asc" }] }),
    db.trip.findMany({
      where: { status: { in: ["SCHEDULED", "STARTED"] }, departAt: { lt: until }, OR: [{ departAt: { gte: dayStart } }, { status: "STARTED" }] },
      include: { driver: { include: { user: true } }, _count: { select: { seats: true } } },
      orderBy: { departAt: "asc" },
    }),
    offPairs(),
    db.vehicleLocation.findMany({ where: { updatedAt: { gte: new Date(now.getTime() - LIVE_MIN * 60_000) } } }),
    db.booking.findMany({ where: { kind: "RENTAL", startedAt: { not: null }, completedAt: null, status: "CONFIRMED" }, include: { driver: { include: { user: true } } } }),
  ]);

  // Show the routes that matter first: those with trips coming up, then the rest.
  const tripsOn = (routeId: string, vehicleId: string) => trips.filter((t) => t.routeId === routeId && t.vehicleId === vehicleId);
  const busy = routes.filter((r) => trips.some((t) => t.routeId === r.id));
  const quiet = routes.filter((r) => !busy.includes(r));
  const live = new Map(locations.map((l) => [l.vehicleId, l]));
  const onRoad = vehicles.filter((v) => live.has(v.id) || trips.some((t) => t.vehicleId === v.id && t.status === "STARTED") || rentalsNow.some((b) => b.vehicleId === v.id));

  return (
    <div className="space-y-4">
      <h1 className="page-title">Fleet on routes</h1>
      <AutoRefresh seconds={60} />
      <p className="text-sm text-slate-500">
        Switch a vehicle <b>off</b> on a route and its shared trips there disappear from customer search (bookings already made stay), and it isn&apos;t offered
        for full-cab hire on that route. Switch it back <b>on</b> any time. The office can still enter phone bookings.
      </p>

      <section className="card p-4">
        <h2 className="mb-2 font-bold">On the road now</h2>
        {onRoad.length === 0 ? (
          <p className="text-sm text-slate-400">No vehicle is on a trip right now.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {onRoad.map((v) => {
              const t = trips.find((x) => x.vehicleId === v.id && x.status === "STARTED");
              const r = t && routes.find((x) => x.id === t.routeId);
              const rental = rentalsNow.find((b) => b.vehicleId === v.id);
              const loc = live.get(v.id);
              return (
                <li key={v.id} className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-600" aria-hidden /> {v.name} · <span className="font-mono">{v.regNumber}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    {r ? `${r.fromCity} → ${r.toCity} · left ${fmtTime(t!.startedAt ?? t!.departAt)}` : rental ? `Full cab ${rental.code}` : "Sharing location"}
                    {(t?.driver ?? rental?.driver) ? ` · ${(t?.driver ?? rental?.driver)!.user.name}` : ""}
                  </p>
                  {loc ? (
                    <a href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand">
                      Location ({fmtTime(loc.updatedAt)}{loc.speed != null ? `, ${Math.round(loc.speed)} km/h` : ""}) →
                    </a>
                  ) : (
                    <span className="text-xs text-amber-700">No live location yet</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {[...busy, ...quiet].map((r) => (
        <section key={r.id} className="card overflow-x-auto">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-2">
            <h2 className="font-bold">
              {r.fromCity} → {r.toCity}
            </h2>
            <span className="text-xs text-slate-500">
              {r.distanceKm} km · {Math.round(r.durationMins / 60)}h
            </span>
          </div>
          <table className="table">
            <tbody>
              {vehicles.map((v) => {
                const on = !isOffIn(off, r.id, v.id);
                const list = tripsOn(r.id, v.id);
                const today = list.filter((t) => t.departAt < dayEnd);
                return (
                  <tr key={v.id} className={on ? "" : "bg-slate-50 opacity-70"}>
                    <td className="w-56">
                      <p className="font-semibold">{v.name}</p>
                      <p className="font-mono text-xs text-slate-500">
                        {v.regNumber} · {v.seats} seats
                      </p>
                    </td>
                    <td className="text-xs">
                      {list.length ? (
                        <>
                          <b>{list.length}</b> trip{list.length > 1 ? "s" : ""} in the next 14 days
                          {list[0] ? ` · from ${inr(list[0].fare)}` : ""}
                          {today.length > 0 && (
                            <span className="block text-slate-600">
                              Today:{" "}
                              {today.map((t) => (
                                <span key={t.id} className={`mr-2 ${t.status === "STARTED" ? "font-semibold text-green-700" : ""}`}>
                                  {fmtTime(t.departAt)} ({t._count.seats}/{v.seats}
                                  {t.driver ? `, ${t.driver.user.name}` : ", no driver"}){t.status === "STARTED" ? " · on the way" : ""}
                                </span>
                              ))}
                            </span>
                          )}
                        </>
                      ) : v.allowSeatBooking ? (
                        <span className="text-slate-400">No shared trips scheduled</span>
                      ) : (
                        <span className="text-slate-400">
                          Full cab only — <Link href={`/admin/vehicles/${v.id}`} className="text-brand">turn on &quot;Sell individual seats&quot;</Link> to run shared trips
                        </span>
                      )}
                    </td>
                    <td className="w-64 whitespace-nowrap text-right">
                      {on && v.allowSeatBooking && (
                        <Link href={`/admin/trips?routeId=${r.id}&vehicleId=${v.id}#schedule`} className="mr-2 text-xs font-semibold text-brand">
                          Schedule trips
                        </Link>
                      )}
                      <form action={toggleRouteVehicle} className="inline">
                        <input type="hidden" name="routeId" value={r.id} />
                        <input type="hidden" name="vehicleId" value={v.id} />
                        <button
                          className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-green-600 text-white hover:bg-green-700" : "bg-slate-300 text-slate-700 hover:bg-slate-400"}`}
                          title={on ? "Running on this route — click to switch off" : "Switched off — click to switch on"}
                        >
                          {on ? "ON" : "OFF"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
