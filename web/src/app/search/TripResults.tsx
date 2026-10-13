"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Clock, Moon, Sun, Sunrise, Sunset, Users, type LucideIcon } from "lucide-react";
import { fmtDuration, fmtTime, inr, VEHICLE_TYPES } from "@/lib/format";
import VehicleImage from "@/components/VehicleImage";
import Amenities from "@/components/Amenities";

type Trip = {
  id: string;
  fromCity: string;
  toCity: string;
  departAt: string;
  arriveAt: string;
  durationMins: number;
  fare: number;
  boardingPoint: string;
  seatsLeft: number;
  vehicle: { name: string; type: string; seats: number; amenities: string[]; imageUrl: string | null };
};

const SORTS = [
  { id: "early", label: "Earliest" },
  { id: "cheap", label: "Cheapest" },
  { id: "seats", label: "Most seats" },
] as const;

const SLOTS: { id: string; label: string; sub: string; icon: LucideIcon; from: number; to: number }[] = [
  { id: "morning", label: "Morning", sub: "6 AM – 12 PM", icon: Sunrise, from: 6, to: 12 },
  { id: "afternoon", label: "Afternoon", sub: "12 PM – 6 PM", icon: Sun, from: 12, to: 18 },
  { id: "evening", label: "Evening", sub: "6 PM – 12 AM", icon: Sunset, from: 18, to: 24 },
  { id: "night", label: "Night", sub: "12 AM – 6 AM", icon: Moon, from: 0, to: 6 },
];

const istHour = (iso: string) => Number(new Date(iso).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })) % 24;

export default function TripResults({ trips }: { trips: Trip[] }) {
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("early");
  const [slots, setSlots] = useState<string[]>([]);

  const shown = useMemo(() => {
    const list = trips.filter((t) => {
      if (!slots.length) return true;
      const h = istHour(t.departAt);
      return SLOTS.some((s) => slots.includes(s.id) && h >= s.from && h < s.to);
    });
    return [...list].sort((a, b) =>
      sort === "cheap" ? a.fare - b.fare || a.departAt.localeCompare(b.departAt) : sort === "seats" ? b.seatsLeft - a.seatsLeft : a.departAt.localeCompare(b.departAt),
    );
  }, [trips, sort, slots]);

  const slotCount = (id: string) => {
    const s = SLOTS.find((x) => x.id === id)!;
    return trips.filter((t) => {
      const h = istHour(t.departAt);
      return h >= s.from && h < s.to;
    }).length;
  };

  const toggleSlot = (id: string) => setSlots((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="h-fit space-y-4 lg:sticky lg:top-24">
        <div className="card p-4">
          <p className="mb-3 flex items-center justify-between text-sm font-bold text-ink">
            Departure time
            {slots.length > 0 && (
              <button onClick={() => setSlots([])} className="text-xs font-semibold text-brand hover:underline">
                Clear
              </button>
            )}
          </p>
          <div className="grid grid-cols-4 gap-2 lg:grid-cols-2">
            {SLOTS.map((s) => {
              const active = slots.includes(s.id);
              const n = slotCount(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSlot(s.id)}
                  disabled={n === 0 && !active}
                  aria-pressed={active}
                  className={`flex flex-col items-center rounded-xl px-2 py-2.5 text-center ring-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    active ? "bg-brand-light text-brand ring-brand" : "text-slate-600 ring-slate-200 hover:ring-slate-300"
                  }`}
                >
                  <s.icon className="h-5 w-5" aria-hidden />
                  <span className="mt-1 text-xs font-bold">{s.label}</span>
                  <span className="hidden text-[10px] text-slate-400 sm:block">{s.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Showing <b className="text-ink">{shown.length}</b> of {trips.length} departure{trips.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200" role="radiogroup" aria-label="Sort by">
            <ArrowUpDown className="mx-1.5 h-4 w-4 text-slate-400" aria-hidden />
            {SORTS.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={sort === s.id}
                onClick={() => setSort(s.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${sort === s.id ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">
            No departures match this filter.{" "}
            <button onClick={() => setSlots([])} className="font-semibold text-brand hover:underline">
              Show all
            </button>
          </div>
        ) : (
          <ul className="space-y-4">
            {shown.map((t) => {
              const soldOut = t.seatsLeft <= 0;
              const few = !soldOut && t.seatsLeft <= 3;
              return (
                <li key={t.id} className={`card overflow-hidden transition hover:shadow-[var(--shadow-lift)] ${soldOut ? "opacity-70" : ""}`}>
                  <div className="grid gap-4 p-4 sm:grid-cols-[140px_1fr] sm:p-5 md:grid-cols-[140px_1fr_170px]">
                    <div className="flex gap-3 sm:block">
                      <VehicleImage vehicle={t.vehicle} className="h-20 w-28 shrink-0 rounded-xl sm:h-24 sm:w-full" sizes="160px" />
                      <div className="sm:mt-2">
                        <p className="leading-tight font-bold text-ink">{t.vehicle.name}</p>
                        <p className="text-xs text-slate-500">
                          {VEHICLE_TYPES[t.vehicle.type] ?? t.vehicle.type} · {t.vehicle.seats} seats
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-2xl font-extrabold text-ink tabular-nums">{fmtTime(t.departAt)}</p>
                          <p className="text-xs font-medium text-slate-500">{t.fromCity}</p>
                        </div>
                        <div className="flex flex-1 flex-col items-center px-1">
                          <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                            <Clock className="h-3 w-3" aria-hidden /> {fmtDuration(t.durationMins)}
                          </span>
                          <div className="relative mt-1 w-full">
                            <div className="h-px w-full bg-slate-300" />
                            <span className="absolute -top-[3px] left-0 h-[7px] w-[7px] rounded-full border-2 border-brand bg-white" />
                            <span className="absolute -top-[3px] right-0 h-[7px] w-[7px] rounded-full bg-brand" />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-extrabold text-ink tabular-nums">{fmtTime(t.arriveAt)}</p>
                          <p className="text-xs font-medium text-slate-500">{t.toCity}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Amenities items={t.vehicle.amenities} />
                      </div>
                      {t.boardingPoint && <p className="mt-2 text-xs text-slate-500">{t.boardingPoint}</p>}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-3 sm:col-span-2 md:col-span-1 md:flex-col md:items-end md:justify-center md:border-t-0 md:border-l md:pt-0 md:pl-5">
                      <div className="md:text-right">
                        <p className="text-xs text-slate-500">per seat</p>
                        <p className="text-2xl font-extrabold text-ink">{inr(t.fare)}</p>
                        <p className={`mt-0.5 flex items-center gap-1 text-xs font-semibold md:justify-end ${soldOut ? "text-slate-500" : few ? "text-red-600" : "text-green-700"}`}>
                          <Users className="h-3.5 w-3.5" aria-hidden />
                          {soldOut ? "Sold out" : few ? `Only ${t.seatsLeft} left` : `${t.seatsLeft} seats left`}
                        </p>
                      </div>
                      {soldOut ? (
                        <span className="btn-ghost pointer-events-none opacity-60">Sold out</span>
                      ) : (
                        <Link href={`/trip/${t.id}`} className="btn-accent px-5 md:w-full">
                          Select seats
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-400">Fares are per seat. 5% GST is added at checkout.</p>
      </div>
    </div>
  );
}
