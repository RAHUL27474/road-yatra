import { db } from "./db";
import { ymd } from "./format";
import { cashDue } from "./booking";

export type Report = { title: string; note: string; columns: string[]; rows: (string | number)[][] };

export const REPORTS: Record<string, string> = {
  daily: "Daily sales",
  route: "Route-wise",
  vehicle: "Vehicle-wise",
  driver: "Driver-wise",
  occupancy: "Seat occupancy",
  cancellations: "Cancellations & refunds",
  payments: "Payments",
  gst: "GST summary",
};

const SOLD = ["CONFIRMED", "COMPLETED"];
const r2 = (n: number) => Math.round(n * 100) / 100;

function group<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const i of items) m.set(key(i), [...(m.get(key(i)) ?? []), i]);
  return m;
}

/** Builds one report for the IST date range [from, to] (YYYY-MM-DD, inclusive). */
export async function buildReport(type: string, from: string, to: string): Promise<Report> {
  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 24 * 3600_000);
  const range = { gte: start, lt: end };
  const include = { trip: { include: { route: true, vehicle: true, driver: { include: { user: true } } } }, vehicle: true, driver: { include: { user: true } } } as const;

  switch (type) {
    case "daily": {
      const bookings = await db.booking.findMany({ where: { createdAt: range, status: { not: "EXPIRED" } } });
      const days = group(bookings, (b) => ymd(b.createdAt));
      return {
        title: REPORTS.daily,
        note: "By booking date. Gross = confirmed and completed bookings.",
        columns: ["Date", "Bookings", "Shared seats", "Full cabs", "Gross (₹)", "Online paid (₹)", "Cash (₹)", "Cancelled", "Refunds (₹)"],
        rows: [...days.entries()].sort().map(([d, list]) => {
          const sold = list.filter((b) => SOLD.includes(b.status));
          return [
            d,
            sold.length,
            sold.filter((b) => b.kind === "SEAT").reduce((n, b) => n + b.passengers, 0),
            sold.filter((b) => b.kind === "RENTAL").length,
            sold.reduce((n, b) => n + b.totalAmount, 0),
            // Online: full online payments plus advances. Cash: cash bookings plus the balance of advance bookings.
            sold.reduce((n, b) => n + (b.paymentMode === "ADVANCE" ? b.amountPaid : b.paymentStatus === "PAID" && b.paymentMode !== "CASH" ? b.totalAmount : 0), 0),
            sold.reduce((n, b) => n + (b.paymentMode === "CASH" ? b.totalAmount : b.paymentMode === "ADVANCE" ? b.totalAmount - b.amountPaid : 0), 0),
            list.filter((b) => b.status === "CANCELLED").length,
            list.reduce((n, b) => n + (b.refundAmount ?? 0), 0),
          ];
        }),
      };
    }
    case "route": {
      const bookings = await db.booking.findMany({ where: { createdAt: range, status: { in: SOLD } }, include });
      const byRoute = group(bookings, (b) => (b.trip ? `${b.trip.route.fromCity} → ${b.trip.route.toCity}` : `${b.pickupCity}${b.dropCity ? ` → ${b.dropCity}` : " (local)"}`));
      return {
        title: REPORTS.route,
        note: "By booking date, confirmed and completed bookings.",
        columns: ["Route", "Shared bookings", "Shared passengers", "Full cabs", "Revenue (₹)"],
        rows: [...byRoute.entries()]
          .map(([route, list]) => [
            route,
            list.filter((b) => b.kind === "SEAT").length,
            list.filter((b) => b.kind === "SEAT").reduce((n, b) => n + b.passengers, 0),
            list.filter((b) => b.kind === "RENTAL").length,
            list.reduce((n, b) => n + b.totalAmount, 0),
          ])
          .sort((a, b) => Number(b[4]) - Number(a[4])),
      };
    }
    case "vehicle":
    case "driver": {
      const [bookings, trips] = await Promise.all([
        db.booking.findMany({ where: { status: { in: SOLD }, OR: [{ trip: { departAt: range } }, { startAt: range }] }, include }),
        db.trip.findMany({ where: { departAt: range, status: { in: ["SCHEDULED", "STARTED", "COMPLETED"] } }, include: { vehicle: true, driver: { include: { user: true } }, route: true } }),
      ]);
      const keyOfBooking = (b: (typeof bookings)[number]) =>
        type === "vehicle"
          ? `${(b.trip?.vehicle ?? b.vehicle)?.regNumber} · ${(b.trip?.vehicle ?? b.vehicle)?.name}`
          : (b.trip?.driver ?? b.driver)?.user.name ?? "Not assigned";
      const keyOfTrip = (t: (typeof trips)[number]) => (type === "vehicle" ? `${t.vehicle.regNumber} · ${t.vehicle.name}` : t.driver?.user.name ?? "Not assigned");
      const keys = [...new Set([...bookings.map(keyOfBooking), ...trips.map(keyOfTrip)])].sort();
      return {
        title: type === "vehicle" ? REPORTS.vehicle : REPORTS.driver,
        note: "By journey date.",
        columns: [type === "vehicle" ? "Vehicle" : "Driver", "Shared trips", "Shared passengers", "Full cabs", "Approx. km", "Revenue (₹)", "Cash still due (₹)"],
        rows: keys.map((k) => {
          const bs = bookings.filter((b) => keyOfBooking(b) === k);
          const ts = trips.filter((t) => keyOfTrip(t) === k);
          const km = ts.reduce((n, t) => n + t.route.distanceKm, 0) + bs.filter((b) => b.kind === "RENTAL").reduce((n, b) => n + (b.endOdometer != null && b.startOdometer != null ? b.endOdometer - b.startOdometer : b.estimatedKm ?? 0), 0);
          return [
            k,
            ts.length,
            bs.filter((b) => b.kind === "SEAT").reduce((n, b) => n + b.passengers, 0),
            bs.filter((b) => b.kind === "RENTAL").length,
            km,
            bs.reduce((n, b) => n + b.totalAmount, 0),
            bs.reduce((n, b) => n + cashDue(b), 0),
          ];
        }),
      };
    }
    case "occupancy": {
      const trips = await db.trip.findMany({
        where: { departAt: range, status: { not: "CANCELLED" } },
        include: { route: true, vehicle: true, bookings: { where: { status: { in: SOLD } } }, seats: { where: { bookingId: null } } },
        orderBy: { departAt: "asc" },
      });
      return {
        title: REPORTS.occupancy,
        note: "Every scheduled shared trip in the range.",
        columns: ["Departure", "Route", "Vehicle", "Seats", "Sold", "Blocked", "Occupancy %", "Revenue (₹)"],
        rows: trips.map((t) => {
          const sold = t.bookings.reduce((n, b) => n + b.passengers, 0);
          return [
            `${ymd(t.departAt)} ${t.departAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}`,
            `${t.route.fromCity} → ${t.route.toCity}`,
            t.vehicle.regNumber,
            t.vehicle.seats,
            sold,
            t.seats.length,
            Math.round((sold / t.vehicle.seats) * 100),
            t.bookings.reduce((n, b) => n + b.totalAmount, 0),
          ];
        }),
      };
    }
    case "cancellations": {
      const list = await db.booking.findMany({ where: { cancelledAt: range }, orderBy: { cancelledAt: "asc" } });
      return {
        title: REPORTS.cancellations,
        note: "By cancellation date.",
        columns: ["Cancelled on", "Booking", "Customer", "Phone", "By", "Amount (₹)", "Paid", "Charge (₹)", "Refund (₹)", "Refund status"],
        rows: list.map((b) => [
          ymd(b.cancelledAt),
          b.code,
          b.passengerName,
          b.passengerPhone,
          b.cancelledBy ?? "",
          b.totalAmount,
          b.paymentStatus === "UNPAID" ? "No" : b.paymentStatus === "PARTIAL" ? "Advance" : "Yes",
          b.cancellationCharge ?? 0,
          b.refundAmount ?? 0,
          b.paymentStatus,
        ]),
      };
    }
    case "payments": {
      const list = await db.booking.findMany({ where: { paidAt: range }, orderBy: { paidAt: "asc" } });
      return {
        title: REPORTS.payments,
        note: "By payment date.",
        columns: ["Paid on", "Invoice", "Booking", "Customer", "Mode", "Payment ID", "Amount (₹)", "Status"],
        // An advance booking shows what was paid online on that date (the cash balance is in the driver cash records).
        rows: list.map((b) => [ymd(b.paidAt), b.invoiceNo ?? "", b.code, b.passengerName, b.paymentMode ?? "", b.paymentId ?? "", b.paymentMode === "ADVANCE" ? b.amountPaid : b.totalAmount, b.paymentStatus]),
      };
    }
    case "gst": {
      const list = await db.booking.findMany({ where: { paidAt: range, invoiceNo: { not: null } } });
      const months = group(list, (b) => ymd(b.paidAt).slice(0, 7));
      return {
        title: REPORTS.gst,
        note: "Invoices issued, by payment month. Share with your CA; cancelled bookings need credit notes for their refunds.",
        columns: ["Month", "Invoices", "Taxable value (₹)", "GST (₹)", "Toll & parking, non-taxable (₹)", "Invoice total (₹)", "Refunded on cancellations (₹)"],
        rows: [...months.entries()].sort().map(([m, bs]) => [
          m,
          bs.length,
          r2(bs.reduce((n, b) => n + b.baseAmount, 0)),
          r2(bs.reduce((n, b) => n + b.taxAmount, 0)),
          r2(bs.reduce((n, b) => n + b.extraCharges, 0)),
          r2(bs.reduce((n, b) => n + b.totalAmount, 0)),
          r2(bs.reduce((n, b) => n + (b.refundAmount ?? 0), 0)),
        ]),
      };
    }
    default:
      throw new Error("Unknown report");
  }
}

export function toCsv(r: Report) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [r.columns, ...r.rows].map((row) => row.map(esc).join(",")).join("\n");
}
