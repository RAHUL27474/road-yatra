import Link from "next/link";
import { db } from "@/lib/db";
import { expireStaleHolds, bookingInclude, cashDue as bookingCashDue, serializeBooking } from "@/lib/booking";
import { fmtDate, fmtTime, inr } from "@/lib/format";
import { bookingTitle, STATUS_STYLE } from "@/components/BookingSummary";
import { AutoRefresh } from "@/components/AutoRefresh";
import { resolveSos } from "./actions";

const DOC_WARN_DAYS = 30;

/** Money received since `from`: full payments by their date, online advances, and drivers' cash by when it was taken. */
async function received(from: Date) {
  const [paid, advances, cash] = await Promise.all([
    // Paid in one go (online, or cash recorded by the office) — driver cash and advances are counted below.
    db.booking.findMany({
      // Not driver cash (counted below by when the driver took it); UPI to the office counts here.
      where: { paymentStatus: { in: ["PAID", "REFUND_PENDING", "REFUNDED"] }, paidAt: { gte: from }, cashCollected: 0, paymentMode: { not: "ADVANCE" } },
      select: { totalAmount: true },
    }),
    // Online advances, whether or not the driver has collected the balance yet (paidAt stays the advance date).
    db.booking.findMany({ where: { paymentMode: "ADVANCE", paidAt: { gte: from }, amountPaid: { gt: 0 }, status: { not: "PENDING" } }, select: { amountPaid: true } }),
    db.booking.findMany({ where: { cashCollectedAt: { gte: from } }, select: { cashCollected: true } }),
  ]);
  const sum = paid.reduce((n, b) => n + b.totalAmount, 0) + advances.reduce((n, b) => n + b.amountPaid, 0) + cash.reduce((n, b) => n + b.cashCollected, 0);
  return { _sum: { totalAmount: sum }, _count: paid.length + advances.length + cash.length };
}

export default async function AdminDashboard() {
  await expireStaleHolds();
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const dayStart = new Date(`${todayStr}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const monthStart = new Date(`${todayStr.slice(0, 7)}-01T00:00:00+05:30`);
  const warnBy = new Date(Date.now() + DOC_WARN_DAYS * 24 * 3600_000);

  const [todayPaid, monthPaid, todayBookings, refundsPending, cashDue, todaysTrips, todaysRentals, recent, vehicles, drivers] = await Promise.all([
    received(dayStart),
    received(monthStart),
    db.booking.groupBy({ by: ["kind"], where: { createdAt: { gte: dayStart }, status: { in: ["CONFIRMED", "COMPLETED"] } }, _count: true }),
    db.booking.count({ where: { OR: [{ paymentStatus: "REFUND_PENDING" }, { seatRefundDue: { gt: 0 } }] } }),
    // Still to come from customers: unpaid cash bookings and the balance after an online advance.
    db.booking
      .findMany({
        where: { status: { in: ["CONFIRMED", "COMPLETED"] }, OR: [{ paymentMode: "CASH", paymentStatus: "UNPAID" }, { paymentStatus: "PARTIAL" }] },
        select: { status: true, paymentStatus: true, totalAmount: true, amountPaid: true },
      })
      .then((list) => ({ _sum: { totalAmount: list.reduce((n, b) => n + bookingCashDue(b), 0) }, _count: list.length })),
    db.trip.findMany({
      where: { status: { in: ["SCHEDULED", "STARTED", "COMPLETED"] }, departAt: { gte: dayStart, lt: dayEnd } },
      include: { route: true, vehicle: true, driver: { include: { user: true } }, _count: { select: { seats: true } } },
      orderBy: { departAt: "asc" },
    }),
    db.booking.findMany({ where: { kind: "RENTAL", status: { in: ["CONFIRMED", "COMPLETED"] }, startAt: { gte: dayStart, lt: dayEnd } }, include: bookingInclude, orderBy: { startAt: "asc" } }),
    db.booking.findMany({ where: { status: { not: "EXPIRED" } }, include: bookingInclude, orderBy: { createdAt: "desc" }, take: 8 }),
    db.vehicle.findMany({ where: { active: true } }),
    db.driver.findMany({ where: { active: true, status: "APPROVED" }, include: { user: true } }),
  ]);

  const [pendingDrivers, sos, driverCash] = await Promise.all([
    db.driver.count({ where: { status: "PENDING" } }),
    db.sosAlert.findMany({ where: { resolvedAt: null }, include: { driver: { include: { user: true } } }, orderBy: { createdAt: "desc" } }),
    db.booking.aggregate({ where: { cashCollectedBy: { not: null }, cashHandedOverAt: null, paymentStatus: "PAID" }, _sum: { cashCollected: true }, _count: true }),
  ]);

  // Documents expiring within 30 days (or already expired)
  const alerts: { what: string; date: Date }[] = [];
  for (const v of vehicles) {
    for (const [label, d] of [["Insurance", v.insuranceExpiry], ["Permit", v.permitExpiry], ["Fitness", v.fitnessExpiry], ["PUC", v.pucExpiry]] as const) {
      if (d && d < warnBy) alerts.push({ what: `${v.regNumber} · ${label}`, date: d });
    }
  }
  for (const d of drivers) if (d.licenceExpiry && d.licenceExpiry < warnBy) alerts.push({ what: `${d.user.name} · Driving licence`, date: d.licenceExpiry });
  alerts.sort((a, b) => a.date.getTime() - b.date.getTime());

  const seatsToday = todaysTrips.reduce((n, t) => n + t.vehicle.seats, 0);
  const soldToday = todaysTrips.reduce((n, t) => n + t._count.seats, 0);
  const count = (k: string) => todayBookings.find((g) => g.kind === k)?._count ?? 0;

  const stats = [
    ["Collected today", inr(todayPaid._sum.totalAmount ?? 0), `${todayPaid._count} payment(s)`],
    ["Collected this month", inr(monthPaid._sum.totalAmount ?? 0), `${monthPaid._count} payment(s)`],
    ["Bookings today", String(count("SEAT") + count("RENTAL")), `${count("SEAT")} shared · ${count("RENTAL")} full cab`],
    ["Seat occupancy today", seatsToday ? `${Math.round((soldToday / seatsToday) * 100)}%` : "—", `${soldToday}/${seatsToday} seats`],
    ["Cash to collect", inr(cashDue._sum.totalAmount ?? 0), `${cashDue._count} booking(s)`],
    ["Cash with drivers", inr(driverCash._sum.cashCollected ?? 0), `${driverCash._count} booking(s) not handed over`],
    ["Refunds pending", String(refundsPending), refundsPending ? "needs action" : "all clear"],
  ];

  return (
    <div className="space-y-6">
      <h1 className="page-title">Dashboard</h1>
      <AutoRefresh />

      {sos.map((a) => (
        <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 border-l-4 border-red-600 bg-red-50 p-4">
          <div>
            <p className="font-extrabold text-red-700">SOS · {a.driver.user.name} pressed the emergency button</p>
            <p className="text-sm text-red-800">
              {fmtTime(a.createdAt)} · {fmtDate(a.createdAt)} · <a href={`tel:${a.driver.user.phone}`} className="font-semibold underline">{a.driver.user.phone}</a>
              {a.vehicleReg ? ` · ${a.vehicleReg}` : ""}
              {a.lat != null && a.lng != null && (
                <>
                  {" · "}
                  <a href={`https://maps.google.com/?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer" className="font-semibold underline">
                    Open location
                  </a>
                </>
              )}
            </p>
          </div>
          <form action={resolveSos}>
            <input type="hidden" name="id" value={a.id} />
            <button className="btn-primary bg-red-600 hover:bg-red-700">Mark resolved</button>
          </form>
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(([label, value, sub]) => (
          <div key={label} className="card p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-2xl font-extrabold">{value}</p>
            <p className="text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      {pendingDrivers > 0 && (
        <Link href="/admin/drivers" className="card flex items-center justify-between border-l-4 border-brand p-4 hover:shadow-md">
          <span className="font-bold">{pendingDrivers} driver application{pendingDrivers > 1 ? "s" : ""} waiting for your approval</span>
          <span className="text-sm font-semibold text-brand">Review →</span>
        </Link>
      )}

      {alerts.length > 0 && (
        <div className="card border-l-4 border-amber-500 p-4">
          <h2 className="mb-2 font-bold text-amber-800">Documents expiring soon</h2>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {alerts.map((a) => (
              <li key={a.what} className={a.date < now ? "font-semibold text-red-700" : ""}>
                {a.what}: {a.date < now ? "expired" : "expires"} {fmtDate(a.date)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-bold">Today&apos;s shared trips</h2>
          {todaysTrips.length === 0 ? (
            <p className="text-sm text-slate-400">No trips today.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {todaysTrips.map((t) => (
                <li key={t.id} className="flex justify-between gap-2 py-2">
                  <div>
                    <Link href={`/admin/trips/${t.id}`} className="font-medium text-brand">
                      {fmtTime(t.departAt)} · {t.route.fromCity} → {t.route.toCity}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {t.vehicle.regNumber} · {t.driver ? t.driver.user.name : <span className="font-semibold text-red-600">No driver</span>}
                      {t.driver && t.driverResponse === "ACCEPTED" && <span className="text-green-700"> · accepted</span>}
                      {t.driver && !t.driverResponse && t.status === "SCHEDULED" && <span className="text-amber-700"> · not accepted yet</span>}
                    </p>
                    {!t.driver && t.driverNote && <p className="text-xs font-semibold text-red-600">{t.driverNote}</p>}
                  </div>
                  <div className="text-right">
                    <p>{t._count.seats}/{t.vehicle.seats} seats</p>
                    <span className="badge bg-slate-100 text-slate-600">{t.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <h2 className="mb-3 font-bold">Today&apos;s full-cab pickups</h2>
          {todaysRentals.length === 0 ? (
            <p className="text-sm text-slate-400">No full-cab pickups today.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {todaysRentals.map((b) => (
                <li key={b.id} className="py-2">
                  <p className="font-medium">
                    {fmtTime(b.startAt!)} · {b.vehicle?.regNumber} · {b.driver ? b.driver.user.name : <span className="font-semibold text-red-600">No driver</span>}
                  </p>
                  {!b.driver && b.driverNote && <p className="text-xs font-semibold text-red-600">{b.driverNote}</p>}
                  <p className="text-slate-500">
                    {b.passengerName} · {b.passengerPhone} · {b.pickupAddress}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Latest bookings</h2>
          <Link href="/admin/bookings" className="text-sm font-semibold text-brand">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Journey</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => {
                const b = serializeBooking(row);
                return (
                  <tr key={b.id}>
                    <td className="font-mono">{b.code}</td>
                    <td>{bookingTitle(b)}</td>
                    <td>{b.passengerName}</td>
                    <td>{inr(b.totalAmount)}</td>
                    <td>
                      <span className={`badge ${STATUS_STYLE[b.status] ?? ""}`}>{b.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
