"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/geo-client";

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:34px;height:34px;transform:translateY(-14px)"><svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="#16a34a" stroke="white" stroke-width="1.6"/><circle cx="12" cy="10" r="2.6" fill="white"/></svg></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

/** OpenStreetMap where the customer taps (or drags the pin) to mark the exact pickup spot. Load with next/dynamic, ssr: false. */
export default function PinMap({ value, center, onChange }: { value: LatLng | null; center: LatLng | null; onChange: (p: LatLng) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!el.current || map.current) return;
    const start = value ?? center;
    map.current = L.map(el.current).setView(start ? [start.lat, start.lng] : [28.9, 79.9], value ? 16 : start ? 13 : 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map.current);
    map.current.on("click", (e: L.LeafletMouseEvent) => change.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    return () => {
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is created once; later pins move the marker below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([value.lat, value.lng], { icon: pinIcon, draggable: true }).addTo(map.current);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        change.current({ lat: p.lat, lng: p.lng });
      });
    } else marker.current.setLatLng([value.lat, value.lng]);
    if (map.current.getZoom() < 15) map.current.setView([value.lat, value.lng], 16);
    else map.current.panTo([value.lat, value.lng]);
  }, [value]);

  return <div ref={el} className="relative z-0 h-64 w-full overflow-hidden rounded-xl ring-1 ring-slate-200" />;
}
