"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Track } from "./TrackView";

const pin = (emoji: string, bg: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${bg};width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:18px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)">${emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
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
      L.marker([data.pickup.lat, data.pickup.lng], { icon: pin("🟢", "#dcfce7") }).bindTooltip(`Pickup: ${data.pickup.name}`).addTo(layer.current);
      points.push([data.pickup.lat, data.pickup.lng]);
    }
    if (data.drop) {
      L.marker([data.drop.lat, data.drop.lng], { icon: pin("🏁", "#fee2e2") }).bindTooltip(`Drop: ${data.drop.name}`).addTo(layer.current);
      points.push([data.drop.lat, data.drop.lng]);
    }
    if (data.location) {
      L.marker([data.location.lat, data.location.lng], { icon: pin("🚙", "#dbeafe"), zIndexOffset: 1000 }).bindTooltip(data.vehicle?.number ?? "Vehicle").addTo(layer.current);
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

  return <div ref={el} className="h-80 w-full overflow-hidden rounded-xl ring-1 ring-slate-200 sm:h-96" />;
}
