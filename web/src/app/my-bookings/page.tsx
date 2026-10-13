import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { bookingInclude, expireStaleHolds, serializeBooking } from "@/lib/booking";
import { fmtDateTime, inr } from "@/lib/format";
import { bookingTitle, STATUS_STYLE } from "@/components/BookingSummary";

export const metadata = { title: "My trips" };

export default async function MyBookings() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/my-bookings");
  await expireStaleHolds();
  const rows = await db.booking.findMany({
    where: { userId: user.id, status: { not: "EXPIRED" } },
    include: bookingInclude,
    orderBy: { createdAt: "desc" },
  });
  const bookings = rows.map((r) => serializeBooking(r));
  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => ["PENDING", "CONFIRMED"].includes(b.status) && ((b.startAt && new Date(b.startAt).getTime() > now) || b.tripStatus === "STARTED"),
  );
  const past = bookings.filter((b) => !upcoming.includes(b));

  const list = (items: typeof bookings) =>
    items.map((b) => (
      <Link key={b.id} href={`/booking/${b.code}`} className="card flex items-center justify-between gap-4 p-4 transition hover:shadow-md">
        <div>
          <p className="font-bold">{bookingTitle(b)}</p>
          <p className="text-sm text-slate-500">
            {b.startAt ? fmtDateTime(b.startAt) : ""} · {b.vehicle?.name}
            {b.seatNos.length ? ` · Seats ${b.seatNos.join(", ")}` : ""}
          </p>
          <p className="font-mono text-xs text-slate-400">{b.code}</p>
        </div>
        <div className="text-right">
          <span className={`badge ${STATUS_STYLE[b.status] ?? ""}`}>{b.status}</span>
          <p className="mt-1 font-bold">{inr(b.totalAmount)}</p>
        </div>
      </Link>
    ));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">My trips</h1>
      {bookings.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-5xl">🧳</p>
          <p className="mt-3 font-bold">No trips yet</p>
          <Link href="/" className="btn-primary mt-4">Book your first trip</Link>
        </div>
      ) : (
        <>
          <h2 className="mb-2 font-semibold text-slate-500">Upcoming</h2>
          <div className="space-y-3">{upcoming.length ? list(upcoming) : <p className="text-sm text-slate-400">No upcoming trips.</p>}</div>
          {past.length > 0 && (
            <>
              <h2 className="mb-2 mt-8 font-semibold text-slate-500">Past & cancelled</h2>
              <div className="space-y-3">{list(past)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
