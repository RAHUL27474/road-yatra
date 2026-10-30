"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CarFront, Headset, Navigation, Phone, Share2, Siren, UserRound } from "lucide-react";
import { fmtDateTime, fmtTime } from "@/lib/format";

const TrackMap = dynamic(() => import("./TrackMap"), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-2xl bg-slate-200 sm:h-[26rem]" /> });

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
  eta: { minutes: number; km?: number; to: "pickup" | "drop"; place: string } | null;
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
  if (!data) return <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />;

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

  const live = data.tripStatus === "STARTED" && data.status !== "CANCELLED";

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-brand-darker via-brand-dark to-brand p-5 text-white">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-slate-300 uppercase">Booking {data.code}</p>
            <h1 className="mt-0.5 text-xl font-extrabold">{data.title}</h1>
          </div>
          {live && (
            <span className="badge shrink-0 bg-white/15 text-white ring-1 ring-white/30">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              LIVE
            </span>
          )}
        </div>
        <div className="p-5">
          <p className="flex items-start gap-2 font-semibold text-brand">
            <Navigation className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {statusText}
          </p>
          {data.eta && (
            <div className="mt-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{data.eta.to === "pickup" ? "Driver arriving in" : "Reaching drop in"}</p>
              <p className="text-3xl font-extrabold text-ink">
                ~{data.eta.minutes >= 60 ? `${Math.floor(data.eta.minutes / 60)}h ${data.eta.minutes % 60}m` : `${data.eta.minutes} min`}
                {data.eta.km != null && <span className="ml-2 text-lg font-bold text-brand">· {data.eta.km < 1 ? `${Math.round(data.eta.km * 1000)} m` : `${data.eta.km} km`} away</span>}
              </p>
              <p className="text-sm text-slate-500">to {data.eta.place} (approx., by road)</p>
            </div>
          )}
          {data.location && (
            <p className={`mt-1 text-xs ${data.location.stale ? "text-amber-700" : "text-slate-400"}`}>
              {data.location.stale ? "Signal lost — last location from " : "Updated "}
              {fmtTime(data.location.updatedAt)}
              {data.location.speed != null && !data.location.stale ? ` · ${Math.round(data.location.speed)} km/h` : ""}
            </p>
          )}
        </div>
      </div>

      {(data.location || data.pickup || data.drop) && <TrackMap data={data} />}

      {(data.driver || data.vehicle) && (
        <div className="card grid gap-4 p-5 text-sm sm:grid-cols-2">
          {data.driver && (
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-light text-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {data.driver.photoUrl ? <img src={data.driver.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6" aria-hidden />}
              </span>
              <div>
                <p className="text-xs text-slate-400">Your driver</p>
                <p className="font-bold text-ink">{data.driver.name}</p>
                <a href={`tel:${data.driver.phone}`} className="inline-flex items-center gap-1 font-semibold text-brand">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> {data.driver.phone}
                </a>
              </div>
            </div>
          )}
          {data.vehicle && (
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                <CarFront className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <p className="text-xs text-slate-400">Vehicle</p>
                <p className="font-bold text-ink">{data.vehicle.name}</p>
                {data.vehicle.number && <p className="inline-block rounded-md border border-slate-300 bg-yellow-50 px-2 font-mono text-sm font-bold tracking-wider text-ink">{data.vehicle.number}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          className="btn-ghost py-3"
          onClick={() => {
            const url = window.location.href;
            if (navigator.share) navigator.share({ title: "Track my trip", url }).catch(() => {});
            else navigator.clipboard.writeText(url).then(() => alert("Link copied. Share it with family."));
          }}
        >
          <Share2 className="h-4 w-4" aria-hidden /> Share live trip
        </button>
        <a href={`tel:${supportPhone}`} className="btn-ghost py-3">
          <Headset className="h-4 w-4" aria-hidden /> Support
        </a>
        <a href="tel:112" className="btn-danger py-3">
          <Siren className="h-4 w-4" aria-hidden /> SOS (112)
        </a>
      </div>
    </div>
  );
}
