"use client";

import { useEffect, useRef, useState } from "react";
import { Navigation, Square } from "lucide-react";

const SEND_EVERY_MS = 20_000;

/**
 * Lets the passenger share their live location with the driver around pickup time. Sends the position while this
 * page stays open (every ~20 s), and clears it on "Stop sharing". `token` is the booking's view link token, if any.
 */
export default function ShareLocation({ bookingId, token, initiallySharing }: { bookingId: string; token?: string; initiallySharing: boolean }) {
  const [sharing, setSharing] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const watch = useRef<number | null>(null);
  const lastPost = useRef(0);
  const url = `/api/bookings/${bookingId}/location${token ? `?t=${encodeURIComponent(token)}` : ""}`;

  const stopWatching = () => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
  };
  useEffect(() => stopWatching, []);

  async function send(lat: number, lng: number) {
    lastPost.current = Date.now();
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat, lng }) });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error || "Couldn't send your location.");
      stopWatching();
      setSharing(false);
      return;
    }
    setLastSent(new Date());
  }

  function start() {
    setError("");
    if (!navigator.geolocation) return setError("This browser can't share your location.");
    setSharing(true);
    lastPost.current = 0;
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - lastPost.current >= SEND_EVERY_MS) send(p.coords.latitude, p.coords.longitude);
      },
      (e) => {
        setError(e.code === e.PERMISSION_DENIED ? "Location is blocked. Allow location for this site in your browser settings." : "Couldn't find your location. Turn on GPS.");
        stopWatching();
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
  }

  async function stop() {
    stopWatching();
    setSharing(false);
    setLastSent(null);
    await fetch(url, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
      <p className="font-semibold text-brand-dark">Help the driver find you</p>
      <p className="text-xs text-slate-600">
        Share your live location with the driver until you board. It is sent only while this page is open.
        {initiallySharing && !sharing ? " (Your last shared location is still visible to the driver for a few minutes.)" : ""}
      </p>
      {sharing ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Sharing live
            {lastSent ? ` · sent ${lastSent.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : " · finding you…"}
          </span>
          <button type="button" onClick={stop} className="btn-ghost px-3 py-1.5 text-xs">
            <Square className="h-3.5 w-3.5" aria-hidden /> Stop sharing
          </button>
        </div>
      ) : (
        <button type="button" onClick={start} className="btn-primary mt-2 px-3 py-2 text-sm">
          <Navigation className="h-4 w-4" aria-hidden /> Share my live location
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
