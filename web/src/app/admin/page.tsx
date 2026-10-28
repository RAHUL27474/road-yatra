import Link from "next/link";
import { db } from "@/lib/db";
import { expireStaleHolds, bookingInclude, cashDue as bookingCashDue, serializeBooking } from "@/lib/booking";
import { fmtDate, fmtTime, inr } from "@/lib/format";
import { bookingTitle, STATUS_STYLE } from "@/components/BookingSummary";
import { AutoRefresh } from "@/components/AutoRefresh";
import {
  AlertTriangle,
  Armchair,
  CalendarClock,
  CarFront,
  ChevronRight,
  FileWarning,
  HandCoins,
  IndianRupee,
  RotateCcw,
  Siren,
  Ticket,
  TrendingUp,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { resolveSos } from "./actions";

const DOC_WARN_DAYS = 30;

type Tone = "brand" | "green" | "amber" | "slate";
type Stat = { label: string; value: string; sub: string; icon: LucideIcon; tone: Tone; bar?: number | null; href?: string };

const TONE: Record<Tone, string> = {
  brand: "bg-brand-light text-brand",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-slate-100 text-slate-600",
};

function StatTile({ s }: { s: Stat }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{s.label}</p>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:h-9 sm:w-9 ${TONE[s.tone]}`}>
          <s.icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-xl leading-tight font-extrabold tracking-tight text-ink tabular-nums sm:text-[26px]">{s.value}</p>
      {s.bar != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, s.bar)}%` }} />
        </div>
      )}
      <p className={`mt-1.5 text-xs ${s.tone === "amber" ? "font-semibold text-amber-700" : "text-slate-400"}`}>{s.sub}</p>
    </>
  );
  const cls = `card p-3.5 sm:p-4 ${s.tone === "amber" ? "ring-amber-300" : ""}`;
  return s.href ? (
    <Link href={s.href} className={`${cls} card-hover block`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A dashboard panel: white card with a header row (icon, title, optional link) above its content. */
function Panel({ title, icon: Icon, action, children }: { title: string; icon: LucideIcon; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
          <Icon className="h-4 w-4 text-slate-400" aria-hidden />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const TRIP_STATUS: Record<string, string> = {
  SCHEDULED: "bg-slate-100 text-slate-600",
  STARTED: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
};

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
    db.booking.aggregate({ where: { cashCollectedBy: { not: null }, cashHandedOverAt: null, cashCollected: { gt: 0 } }, _sum: { cashCollected: true }, _count: true }),
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

  const occupancy = seatsToday ? Math.round((soldToday / seatsToday) * 100) : null;
  // Money first (the headline row), then the day's operations; amber only when something needs doing.
  const money: Stat[] = [
    { label: "Collected today", value: inr(todayPaid._sum.totalAmount ?? 0), sub: `${todayPaid._count} payment(s)`, icon: IndianRupee, tone: "green" },
    { label: "Collected this month", value: inr(monthPaid._sum.totalAmount ?? 0), sub: `${monthPaid._count} payment(s)`, icon: TrendingUp, tone: "brand" },
    { label: "Cash to collect", value: inr(cashDue._sum.totalAmount ?? 0), sub: `${cashDue._count} booking(s) unpaid`, icon: Wallet, tone: "slate" },
    {
      label: "Cash with drivers",
      value: inr(driverCash._sum.cashCollected ?? 0),
      sub: driverCash._count ? `${driverCash._count} booking(s) not handed over` : "all handed over",
      icon: HandCoins,
      tone: driverCash._count ? "amber" : "slate",
    },
  ];
  const ops: Stat[] = [
    { label: "Bookings today", value: String(count("SEAT") + count("RENTAL")), sub: `${count("SEAT")} shared · ${count("RENTAL")} full cab`, icon: Ticket, tone: "brand" },
    { label: "Seat occupancy today", value: occupancy == null ? "—" : `${occupancy}%`, sub: `${soldToday}/${seatsToday} seats sold`, icon: Armchair, tone: "brand", bar: occupancy },
    { label: "Trips today", value: String(todaysTrips.length + todaysRentals.length), sub: `${todaysTrips.length} shared · ${todaysRentals.length} full cab`, icon: CalendarClock, tone: "slate" },
    {
      label: "Refunds pending",
      value: String(refundsPending),
      sub: refundsPending ? "needs action" : "all clear",
      icon: RotateCcw,
      tone: refundsPending ? "amber" : "green",
      href: refundsPending ? "/admin/bookings" : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Today&apos;s money, trips and anything that needs your attention.</p>
        </div>
        <Link href="/admin/reports" className="btn-ghost py-2 text-[13px]">
          Reports <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <AutoRefresh />

      {sos.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-600 p-4 text-white shadow-lg shadow-red-600/20">
          <div className="flex items-start gap-3">
            <Siren className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            <div>
              <p className="font-extrabold">SOS · {a.driver.user.name} pressed the emergency button</p>
              <p className="text-sm text-red-50">
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
          </div>
          <form action={resolveSos}>
            <input type="hidden" name="id" value={a.id} />
            <button className="btn bg-white text-red-700 hover:bg-red-50">Mark resolved</button>
          </form>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {money.map((s) => (
          <StatTile key={s.label} s={s} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {ops.map((s) => (
          <StatTile key={s.label} s={s} />
        ))}
      </div>

      {(pendingDrivers > 0 || alerts.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {pendingDrivers > 0 && (
            <Link href="/admin/drivers" className="card card-hover flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-light text-brand">
                <UserPlus className="h-5 w-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-ink">
                  {pendingDrivers} driver application{pendingDrivers > 1 ? "s" : ""} to review
                </span>
                <span className="text-sm text-slate-500">Waiting for your approval</span>
              </span>
              <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden />
            </Link>
          )}
          {alerts.length > 0 && (
            <div className="card flex gap-3 p-4 ring-amber-300">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700">
                <FileWarning className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-bold text-ink">Documents expiring soon</h2>
                <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                  {alerts.map((a) => (
                    <li key={a.what} className={a.date < now ? "font-semibold text-red-700" : ""}>
                      {a.what}: {a.date < now ? "expired" : "expires"} {fmtDate(a.date)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Today's shared trips"
          icon={CalendarClock}
          action={
            <Link href="/admin/trips" className="text-[13px] font-semibold text-brand hover:underline">
              Schedule
            </Link>
          }
        >
          {todaysTrips.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No shared trips today.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {todaysTrips.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-16 shrink-0 font-bold text-ink tabular-nums">{fmtTime(t.departAt)}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/trips/${t.id}`} className="font-semibold text-ink hover:text-brand">
                      {t.route.fromCity} → {t.route.toCity}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {t.vehicle.regNumber} · {t.driver ? t.driver.user.name : <span className="font-semibold text-red-600">No driver</span>}
                      {t.driver && t.driverResponse === "ACCEPTED" && <span className="text-emerald-700"> · accepted</span>}
                      {t.driver && !t.driverResponse && t.status === "SCHEDULED" && <span className="text-amber-700"> · not accepted yet</span>}
                    </p>
                    {!t.driver && t.driverNote && <p className="text-xs font-semibold text-red-600">{t.driverNote}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">
                      {t._count.seats}/{t.vehicle.seats}
                      <span className="font-normal text-slate-400"> seats</span>
                    </p>
                    <span className={`badge mt-0.5 ${TRIP_STATUS[t.status] ?? "bg-slate-100 text-slate-600"}`}>{t.status.toLowerCase()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Today's full-cab pickups" icon={CarFront}>
          {todaysRentals.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No full-cab pickups today.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {todaysRentals.map((b) => (
                <li key={b.id} className="flex gap-3 px-4 py-3">
                  <span className="w-16 shrink-0 font-bold text-ink tabular-nums">{fmtTime(b.startAt!)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">
                      {b.passengerName} <span className="font-normal text-slate-500">· {b.passengerPhone}</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {b.pickupAddress} · {b.vehicle?.regNumber} · {b.driver ? b.driver.user.name : <span className="font-semibold text-red-600">No driver</span>}
                    </p>
                    {!b.driver && b.driverNote && (
                      <p className="flex items-center gap-1 text-xs font-semibold text-red-600">
                        <AlertTriangle className="h-3 w-3" aria-hidden /> {b.driverNote}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Latest bookings"
        icon={Ticket}
        action={
          <Link href="/admin/bookings" className="text-[13px] font-semibold text-brand hover:underline">
            View all
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Journey</th>
                <th>Customer</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => {
                const b = serializeBooking(row);
                return (
                  <tr key={b.id}>
                    <td className="font-mono text-xs font-semibold text-slate-600">{b.code}</td>
                    <td className="font-medium text-ink">{bookingTitle(b)}</td>
                    <td>{b.passengerName}</td>
                    <td className="text-right font-semibold tabular-nums">{inr(b.totalAmount)}</td>
                    <td>
                      <span className={`badge ${STATUS_STYLE[b.status] ?? ""}`}>{b.status.toLowerCase()}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
