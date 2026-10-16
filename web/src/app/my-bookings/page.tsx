import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Armchair, CalendarDays, CarFront, ChevronRight, Luggage } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { bookingInclude, expireStaleHolds, serializeBooking } from "@/lib/booking";
import { visibleBookingsWhere } from "@/lib/my-bookings";
import { fmtDateTime, inr } from "@/lib/format";
import { cityPhoto, EMPTY_ROAD_IMAGE } from "@/lib/media";
import { bookingTitle, STATUS_STYLE } from "@/components/BookingSummary";

export const metadata = { title: "My trips" };

export default async function MyBookings() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/my-bookings");
  await expireStaleHolds();
  const rows = await db.booking.findMany({
    where: { ...(await visibleBookingsWhere(user.id)), status: { not: "EXPIRED" } },
    include: bookingInclude,
    orderBy: { createdAt: "desc" },
  });
  const bookings = rows.map((r) => serializeBooking(r));
  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => ["PENDING", "CONFIRMED"].includes(b.status) && ((b.startAt && new Date(b.startAt).getTime() > now) || b.tripStatus === "STARTED"),
  );
  const past = bookings.filter((b) => !upcoming.includes(b));

  const list = (items: typeof bookings, faded = false) => (
    <ul className="space-y-3">
      {items.map((b) => {
        const dest = b.trip?.toCity ?? b.dropCity ?? b.pickupCity ?? "";
        const Icon = b.kind === "SEAT" ? Armchair : CarFront;
        return (
          <li key={b.id}>
            <Link href={`/booking/${b.code}`} className={`group card card-hover flex items-stretch overflow-hidden ${faded ? "opacity-80" : ""}`}>
              <div className="relative hidden w-32 shrink-0 sm:block">
                <Image src={cityPhoto(dest)} alt="" fill sizes="128px" className="object-cover" />
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-bold text-ink">
                    <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    <span className="truncate">{bookingTitle(b)}</span>
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      {b.startAt ? fmtDateTime(b.startAt) : ""} · {b.vehicle?.name}
                      {b.seatNos.length ? ` · Seats ${b.seatNos.join(", ")}` : ""}
                    </span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-400">{b.code}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <span className={`badge ${STATUS_STYLE[b.status] ?? ""}`}>{b.status}</span>
                    <p className="mt-1 font-bold text-ink">{inr(b.totalAmount)}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="container-x max-w-4xl py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">My trips</h1>
          <p className="text-sm text-slate-500">Your seat and full cab bookings, newest first.</p>
        </div>
        <Link href="/#search" className="btn-primary">
          Book a new trip
        </Link>
      </div>
      {bookings.length === 0 ? (
        <div className="card grid overflow-hidden md:grid-cols-2">
          <div className="relative aspect-[16/10] md:aspect-auto">
            <Image src={EMPTY_ROAD_IMAGE} alt="An open road" fill sizes="(min-width: 768px) 450px, 100vw" className="object-cover" />
          </div>
          <div className="p-8 sm:p-10">
            <Luggage className="h-8 w-8 text-accent" aria-hidden />
            <p className="mt-3 text-xl font-extrabold text-ink">No trips yet</p>
            <p className="mt-1 text-slate-500">Book a shared seat between Khatima and Delhi, or hire a full cab.</p>
            <Link href="/" className="btn-accent mt-6">
              Book your first trip
            </Link>
          </div>
        </div>
      ) : (
        <>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-500 uppercase">Upcoming</h2>
          {upcoming.length ? list(upcoming) : <p className="card p-5 text-sm text-slate-500">No upcoming trips.</p>}
          {past.length > 0 && (
            <>
              <h2 className="mt-10 mb-3 text-sm font-bold tracking-wide text-slate-500 uppercase">Past &amp; cancelled</h2>
              {list(past, true)}
            </>
          )}
        </>
      )}
    </div>
  );
}
