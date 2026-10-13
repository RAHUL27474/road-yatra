import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { getTripDetail } from "@/lib/trips";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { publicStop } from "@/lib/booking";
import { fmtDate, fmtDuration, fmtTime, VEHICLE_TYPES, ymd } from "@/lib/format";
import VehicleImage from "@/components/VehicleImage";
import Amenities from "@/components/Amenities";
import SeatBooking from "./SeatBooking";

export const metadata = { title: "Select seats" };

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [trip, user, settings] = await Promise.all([getTripDetail(id), getCurrentUser(), getSettings()]);
  if (!trip) notFound();
  const stops = await db.stop.findMany({ where: { active: true, city: { in: [trip.fromCity, trip.toCity] } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const duration = Math.round((trip.arriveAt.getTime() - trip.departAt.getTime()) / 60_000);
  const backHref = `/search?${new URLSearchParams({ from: trip.fromCity, to: trip.toCity, date: ymd(trip.departAt) })}`;

  return (
    <div>
      <div className="bg-gradient-to-r from-brand-darker via-brand-dark to-brand text-white">
        <div className="container-x py-5">
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-100 hover:text-white">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Back to departures
          </Link>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <VehicleImage vehicle={trip.vehicle} className="hidden h-16 w-24 shrink-0 rounded-xl ring-2 ring-white/30 sm:block" sizes="96px" />
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold sm:text-2xl">
                  {trip.fromCity} → {trip.toCity}
                </h1>
                <p className="text-sm text-blue-100">
                  {fmtDate(trip.departAt)} · {trip.vehicle.name} ({VEHICLE_TYPES[trip.vehicle.type] ?? trip.vehicle.type})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20">
              <div>
                <p className="text-xl font-extrabold tabular-nums">{fmtTime(trip.departAt)}</p>
                <p className="text-xs text-blue-100">{trip.fromCity}</p>
              </div>
              <div className="flex flex-col items-center px-2 text-xs text-blue-100">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {fmtDuration(duration)}
              </div>
              <div className="text-right">
                <p className="text-xl font-extrabold tabular-nums">{fmtTime(trip.arriveAt)}</p>
                <p className="text-xs text-blue-100">{trip.toCity}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-blue-100 [&_.chip]:bg-white/15 [&_.chip]:text-white [&_svg]:text-white">
            <Amenities items={trip.vehicle.amenities} />
            {trip.boardingPoint && <span>{trip.boardingPoint}</span>}
          </div>
        </div>
      </div>

      <div className="container-x py-6">
        <SeatBooking
          trip={{ id: trip.id, fare: trip.fare, vehicle: trip.vehicle, takenSeats: trip.takenSeats, fromCity: trip.fromCity, toCity: trip.toCity }}
          pickupStops={stops.filter((s) => s.city === trip.fromCity).map(publicStop)}
          dropStops={stops.filter((s) => s.city === trip.toCity).map(publicStop)}
          allowCash={settings.allowCash}
          user={user ? { name: user.name, phone: user.phone } : null}
          summary={{ departLabel: `${fmtDate(trip.departAt)}, ${fmtTime(trip.departAt)}`, vehicleName: trip.vehicle.name }}
        />
      </div>
    </div>
  );
}
