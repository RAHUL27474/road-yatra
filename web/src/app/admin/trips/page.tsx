import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate, fmtTime, inr } from "@/lib/format";
import Flash from "@/components/Flash";
import { assignTripDriver, cancelTrip, scheduleTrips } from "../actions";

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string; skipped?: string }> }) {
  const { error, created, skipped } = await searchParams;
  const [routes, vehicles, trips, drivers] = await Promise.all([
    db.route.findMany({ orderBy: [{ fromCity: "asc" }, { toCity: "asc" }] }),
    db.vehicle.findMany({ where: { active: true, allowSeatBooking: true } }),
    db.trip.findMany({
      where: { status: { in: ["SCHEDULED", "STARTED"] }, departAt: { gte: new Date(Date.now() - 12 * 3600_000) } },
      include: { route: true, vehicle: true, driver: { include: { user: true } }, _count: { select: { seats: true } } },
      orderBy: { departAt: "asc" },
      take: 200,
    }),
    db.driver.findMany({ where: { active: true, status: "APPROVED" }, include: { user: true } }),
  ]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const success = created ? `Created ${created} trip(s).${Number(skipped) ? ` Skipped ${skipped} day(s) where the vehicle was busy or the time had passed.` : ""}` : undefined;

  return (
    <div className="space-y-4">
      <h1 className="page-title">Trips & schedule</h1>
      <Flash error={error} success={success} />

      <form action={scheduleTrips} className="card space-y-3 p-4">
        <h2 className="font-bold">Schedule seat trips</h2>
        {vehicles.length === 0 ? (
          <p className="text-sm text-amber-700">No active vehicle has &quot;Sell individual seats&quot; turned on. Enable it in Vehicles first.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="label">Route</label>
                <select name="routeId" className="input" required>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fromCity} → {r.toCity} ({r.distanceKm} km)
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Vehicle</label>
                <select name="vehicleId" className="input" required>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {v.regNumber} · {v.seats} seats
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Driver</label>
                <select name="driverId" className="input">
                  <option value="">Assign later</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.user.name} · {d.user.phone}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">First date</label>
                <input name="startDate" type="date" min={today} defaultValue={today} className="input" required />
              </div>
              <div>
                <label className="label">Departure time</label>
                <input name="time" type="time" defaultValue="06:00" className="input" required />
              </div>
              <div>
                <label className="label">Repeat daily for (days)</label>
                <input name="days" type="number" min={1} max={90} defaultValue={7} className="input" required />
              </div>
              <div>
                <label className="label">Fare per seat (₹)</label>
                <input name="fare" type="number" min={1} className="input" required />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Note for passengers (optional)</label>
                <input name="boardingPoint" className="input" placeholder="Please reach your pickup point 10 minutes early" />
              </div>
            </div>
            <button className="btn-primary">Create trips</button>
          </>
        )}
      </form>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Departure</th>
              <th>Route</th>
              <th>Vehicle / driver</th>
              <th>Booked</th>
              <th>Fare</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">No upcoming trips.</td>
              </tr>
            )}
            {trips.map((t) => (
              <tr key={t.id}>
                <td>
                  <p className="font-medium">{fmtTime(t.departAt)}</p>
                  <p className="text-xs text-slate-500">{fmtDate(t.departAt)}</p>
                </td>
                <td>
                  {t.route.fromCity} → {t.route.toCity}
                </td>
                <td className="text-xs">
                  {t.vehicle.name}
                  <br />
                  <span className="font-mono">{t.vehicle.regNumber}</span>
                  <br />
                  {t.status === "STARTED" ? (
                    <>
                      {t.driver?.user.name}
                      <span className="badge ml-1 bg-blue-100 text-blue-700">ON TRIP</span>
                    </>
                  ) : (
                    // Drivers change day to day: pick today's driver right here.
                    <form action={assignTripDriver} className="mt-1 flex items-center gap-1">
                      <input type="hidden" name="id" value={t.id} />
                      <select name="driverId" defaultValue={t.driverId ?? ""} className={`input py-1 text-xs ${t.driverId ? "" : "border-red-300 text-red-600"}`}>
                        <option value="">No driver</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.user.name}
                          </option>
                        ))}
                      </select>
                      <button className="btn-ghost px-2 py-1 text-xs">Save</button>
                    </form>
                  )}
                  {t.driver && t.status === "SCHEDULED" && (
                    <p className={t.driverResponse === "ACCEPTED" ? "text-green-700" : "text-amber-700"}>{t.driverResponse === "ACCEPTED" ? "accepted" : "not accepted yet"}</p>
                  )}
                  {!t.driver && t.driverNote && <p className="font-semibold text-red-600">{t.driverNote}</p>}
                </td>
                <td>
                  {t._count.seats}/{t.vehicle.seats}
                </td>
                <td>{inr(t.fare)}</td>
                <td className="whitespace-nowrap">
                  <Link href={`/admin/trips/${t.id}`} className="mr-3 text-sm font-semibold text-brand">Passengers</Link>
                  <form action={cancelTrip} className="inline">
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-sm font-semibold text-red-600" title="Cancels the trip and all its bookings (marks paid ones for refund)">
                      Cancel
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
