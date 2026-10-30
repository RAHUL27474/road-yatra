"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Crosshair, MapPinned, X } from "lucide-react";
import { currentPosition, mapsLink, type LatLng } from "@/lib/geo-client";

const PinMap = dynamic(() => import("./PinMap"), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-slate-200" /> });

/** "Use my current location" plus a map to tap / drag the exact pickup pin. The driver gets a Navigate button to it. */
export default function PickupPin({ value, onChange, center }: { value: LatLng | null; onChange: (p: LatLng | null) => void; center: LatLng | null }) {
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  async function useMyLocation() {
    setLocating(true);
    setError("");
    try {
      onChange(await currentPosition());
      setShowMap(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-sm font-semibold text-ink">Exact pickup spot on the map (recommended)</p>
      <p className="text-xs text-slate-500">The driver gets directions straight to this pin.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={useMyLocation} disabled={locating} className="btn-primary px-3 py-2 text-sm">
          <Crosshair className="h-4 w-4" aria-hidden /> {locating ? "Finding you…" : "Use my current location"}
        </button>
        <button type="button" onClick={() => setShowMap((v) => !v)} className="btn-ghost px-3 py-2 text-sm">
          <MapPinned className="h-4 w-4" aria-hidden /> {showMap ? "Hide map" : value ? "Adjust pin on map" : "Pick on map"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {value && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-green-700">
          <span className="font-semibold">Pin set ✓</span>
          <a href={mapsLink(value)} target="_blank" rel="noopener" className="underline">
            Check on Google Maps
          </a>
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-0.5 text-slate-500 underline">
            <X className="h-3 w-3" aria-hidden /> Remove
          </button>
        </p>
      )}
      {showMap && (
        <div className="mt-2">
          <PinMap value={value} center={center} onChange={onChange} />
          <p className="mt-1 text-xs text-slate-500">Tap the map to place the pin, or drag it to the exact gate / building.</p>
        </div>
      )}
    </div>
  );
}
