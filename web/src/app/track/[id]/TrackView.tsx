"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fmtDateTime, fmtTime } from "@/lib/format";

const TrackMap = dynamic(() => import("./TrackMap"), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-xl bg-slate-200" /> });

type Point = { lat: number; lng: number; name: string } | null;
export type Track = {
  code: string;
  status: string;
  tripStatus: string;
  title: string;
  startAt: string | null;
  driver: { name: string; phone: string; photoUrl: string | null } | null;
  vehicle: { name: string; number: string | null } | null;
  pickup: Point;
  drop: Point;
  onBoard: boolean;
  location: { lat: number; lng: number; speed: number | null; updatedAt: string; stale: boolean } | null;
  eta: { minutes: number; to: "pickup" | "drop"; place: string } | null;
};

const REFRESH_MS = 15_000;

export default function TrackView({ bookingId, token, supportPhone }: { bookingId: string; token: string; supportPhone: string }) {
  const [data, setData] = useState<Track | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/track/${bookingId}?t=${encodeURIComponent(token)}`, { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) setError(json.error || "Could not load tracking.");
        else {
          setData(json);
          setError("");
        }
      } catch {
        if (alive) setError("Connection problem. Retrying…");
      }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [bookingId, token]);

  if (error && !data) return <div className="card p-8 text-center text-red-700">{error}</div>;
  if (!data) return <div className="h-96 animate-pulse rounded-xl bg-slate-200" />;

  const statusText =
    data.status === "CANCELLED"
      ? "This booking was cancelled."
      : data.tripStatus === "COMPLETED"
        ? "Trip completed. Thank you for travelling with us!"
        : data.tripStatus === "STARTED"
          ? data.onBoard
            ? "On the way to your destination"
            : "Vehicle is on the way to your pickup point"
          : `Trip starts ${data.startAt ? fmtDateTime(data.startAt) : "soon"}. Live location appears once the driver starts the trip.`;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase text-slate-500">Booking {data.code}</p>
        <h1 className="text-xl font-bold">{data.title}</h1>
        <p className="mt-1 font-medium text-brand">{statusText}</p>
        {data.eta && (
          <p className="mt-2 text-2xl font-extrabold">
            ~{data.eta.minutes >= 60 ? `${Math.floor(data.eta.minutes / 60)}h ${data.eta.minutes % 60}m` : `${data.eta.minutes} min`}
            <span className="ml-2 text-sm font-medium text-slate-500">to {data.eta.place} (approx.)</span>
          </p>
        )}
        {data.location && (
          <p className={`mt-1 text-xs ${data.location.stale ? "text-amber-700" : "text-slate-400"}`}>
            {data.location.stale ? "Signal lost — last location from " : "Updated "}
            {fmtTime(data.location.updatedAt)}
            {data.location.speed != null && !data.location.stale ? ` · ${Math.round(data.location.speed)} km/h` : ""}
          </p>
        )}
      </div>

      {(data.location || data.pickup || data.drop) && <TrackMap data={data} />}

      <div className="card grid gap-3 p-4 text-sm sm:grid-cols-2">
        {data.driver && (
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-slate-100 text-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {data.driver.photoUrl ? <img src={data.driver.photoUrl} alt="" className="h-full w-full object-cover" /> : "🧑‍✈️"}
            </span>
            <div>
              <p className="font-bold">{data.driver.name}</p>
              <a href={`tel:${data.driver.phone}`} className="text-brand">📞 {data.driver.phone}</a>
            </div>
          </div>
        )}
        {data.vehicle && (
          <div>
            <p className="font-bold">{data.vehicle.name}</p>
            <p className="font-mono text-lg">{data.vehicle.number}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-ghost"
          onClick={() => {
            const url = window.location.href;
            if (navigator.share) navigator.share({ title: "Track my trip", url }).catch(() => {});
            else navigator.clipboard.writeText(url).then(() => alert("Link copied. Share it with family."));
          }}
        >
          🔗 Share live trip
        </button>
        <a href={`tel:${supportPhone}`} className="btn-ghost">☎️ Support</a>
        <a href="tel:112" className="btn-danger">🆘 SOS (112)</a>
      </div>
    </div>
  );
}
