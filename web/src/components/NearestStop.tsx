"use client";

import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { currentPosition, nearest } from "@/lib/geo-client";

type Stop = { id: string; name: string; lat?: number | null; lng?: number | null };

/** "Use my location" — picks the pickup point closest to the customer. Hidden when no point has coordinates. */
export default function NearestStop({ stops, onPick }: { stops: Stop[]; onPick: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const located = stops.map((s) => ({ ...s, lat: s.lat ?? null, lng: s.lng ?? null }));
  if (!located.some((s) => s.lat != null && s.lng != null)) return null;

  async function find() {
    setBusy(true);
    setNote(null);
    try {
      const best = nearest(await currentPosition(), located);
      if (!best) throw new Error("No pickup point has a map location yet.");
      onPick(best.item.id);
      const away = best.km < 1 ? `${Math.round(best.km * 1000)} m` : `${best.km.toFixed(1)} km`;
      setNote({ ok: true, text: `Nearest to you: ${best.item.name} (${away} away). Selected.` });
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" onClick={find} disabled={busy} className="btn-soft px-3 py-1.5 text-sm">
        <LocateFixed className="h-4 w-4" aria-hidden /> {busy ? "Finding you…" : "Use my location — nearest pickup point"}
      </button>
      {note && <span className={`text-xs ${note.ok ? "text-green-700" : "text-red-700"}`}>{note.text}</span>}
    </div>
  );
}
