import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getTripDetail } from "@/lib/trips";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { publicStop } from "@/lib/booking";
import { fmtDate, fmtTime } from "@/lib/format";
import SeatBooking from "./SeatBooking";

export const metadata = { title: "Select seats" };

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [trip, user, settings] = await Promise.all([getTripDetail(id), getCurrentUser(), getSettings()]);
  if (!trip) notFound();
  const stops = await db.stop.findMany({ where: { active: true, city: { in: [trip.fromCity, trip.toCity] } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="card mb-4 p-4">
        <h1 className="text-xl font-bold">
          {trip.fromCity} → {trip.toCity}
        </h1>
        <p className="text-sm text-slate-500">
          {fmtDate(trip.departAt)} · Departs {fmtTime(trip.departAt)} · {trip.vehicle.name}
          {trip.boardingPoint ? ` · ${trip.boardingPoint}` : ""}
        </p>
      </div>
      <SeatBooking
        trip={{ id: trip.id, fare: trip.fare, vehicle: trip.vehicle, takenSeats: trip.takenSeats, fromCity: trip.fromCity, toCity: trip.toCity }}
        pickupStops={stops.filter((s) => s.city === trip.fromCity).map(publicStop)}
        dropStops={stops.filter((s) => s.city === trip.toCity).map(publicStop)}
        allowCash={settings.allowCash}
        user={user ? { name: user.name, phone: user.phone } : null}
      />
    </div>
  );
}
