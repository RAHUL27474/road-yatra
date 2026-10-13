"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Track } from "./TrackView";

const ICONS = {
  pickup: '<circle cx="12" cy="12" r="5" fill="white"/>',
  drop: '<path d="M8 5v14M8 5h9l-2 3 2 3H8" stroke="white" stroke-width="2" fill="none" stroke-linejoin="round"/>',
  car: '<path d="M5 15l1.5-5A2 2 0 0 1 8.4 8.6h7.2a2 2 0 0 1 1.9 1.4L19 15v3h-2v-1H7v1H5z" fill="white"/><circle cx="8" cy="15" r="1.2" fill="#0b3d91"/><circle cx="16" cy="15" r="1.2" fill="#0b3d91"/>',
};
const pin = (kind: keyof typeof ICONS, bg: string, size = 34) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${bg};width:${size}px;height:${size}px;border-radius:50%;display:grid;place-items:center;border:3px solid white;box-shadow:0 3px 10px rgba(15,23,42,.35)"><svg viewBox="0 0 24 24" width="${size - 12}" height="${size - 12}">${ICONS[kind]}</svg></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

/** OpenStreetMap map with the vehicle, pickup and drop markers. */
export default function TrackMap({ data }: { data: Track }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true }).setView([28.9, 79.9], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const points: L.LatLngExpression[] = [];
    if (data.pickup) {
      L.marker([data.pickup.lat, data.pickup.lng], { icon: pin("pickup", "#16a34a") }).bindTooltip(`Pickup: ${data.pickup.name}`).addTo(layer.current);
      points.push([data.pickup.lat, data.pickup.lng]);
    }
    if (data.drop) {
      L.marker([data.drop.lat, data.drop.lng], { icon: pin("drop", "#dc2626") }).bindTooltip(`Drop: ${data.drop.name}`).addTo(layer.current);
      points.push([data.drop.lat, data.drop.lng]);
    }
    if (data.location) {
      L.marker([data.location.lat, data.location.lng], { icon: pin("car", "#0b3d91", 40), zIndexOffset: 1000 }).bindTooltip(data.vehicle?.number ?? "Vehicle").addTo(layer.current);
      points.push([data.location.lat, data.location.lng]);
    }
    // Fit everything once; after that, follow the vehicle without fighting the user's zoom.
    if (!fitted.current && points.length) {
      map.current.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
      fitted.current = true;
    } else if (data.location) {
      map.current.panTo([data.location.lat, data.location.lng]);
    }
  }, [data]);

  return <div ref={el} className="relative z-0 h-80 w-full overflow-hidden rounded-2xl ring-1 ring-slate-200 sm:h-[26rem]" />;
}
