"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftRight, LocateFixed, Search } from "lucide-react";
import Icon3D, { type Icon3DName } from "./Icon3D";
import { cityState } from "@/lib/media";
import { currentPosition, nearest } from "@/lib/geo-client";

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const tomorrowIST = () => new Date(Date.now() + 24 * 3600_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const tomorrowAt9 = () => `${tomorrowIST()}T09:00`;

const HIRE_TYPES: { id: string; label: string; icon: Icon3DName }[] = [
  { id: "ONE_WAY", label: "One Way", icon: "road" },
  { id: "ROUND_TRIP", label: "Round Trip", icon: "repeat" },
  { id: "LOCAL", label: "Local (8 hr / 80 km)", icon: "stopwatch" },
  { id: "AIRPORT", label: "Airport", icon: "plane" },
];

export type SearchInitial = {
  from?: string;
  to?: string;
  date?: string;
  hireType?: string;
  start?: string;
  ret?: string;
};

function dayParts(ymd: string) {
  const d = new Date(`${ymd}T12:00:00+05:30`);
  if (isNaN(d.getTime())) return { big: "Select date", small: "" };
  const day = d.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" });
  const mon = d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" });
  const yr = d.toLocaleDateString("en-IN", { year: "2-digit", timeZone: "Asia/Kolkata" });
  const wk = d.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });
  const rel = ymd === todayIST() ? "Today · " : ymd === tomorrowIST() ? "Tomorrow · " : "";
  return { big: `${day} ${mon} '${yr}`, small: `${rel}${wk}` };
}

function dateTimeParts(v: string) {
  if (!v) return { big: "Add date", small: "Tap to choose" };
  const [ymd, hm = "09:00"] = v.split("T");
  const p = dayParts(ymd);
  const [h, m] = hm.split(":").map(Number);
  const time = new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return { big: p.big, small: `${p.small.split(" · ").pop()}, ${time}` };
}

const openPicker = (e: React.MouseEvent<HTMLInputElement>) => {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    /* older browsers: the native control still works */
  }
};

/** "Near me": sets the From city to the city of the pickup point closest to the customer. */
function NearMe({ cities, onCity }: { cities: string[]; onCity: (city: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  async function find() {
    setBusy(true);
    setNote("");
    try {
      const [here, res] = await Promise.all([currentPosition(), fetch("/api/stops").then((r) => r.json())]);
      const best = nearest(here, ((res.stops ?? []) as { city: string; lat: number | null; lng: number | null }[]).filter((s) => cities.includes(s.city)));
      if (!best) throw new Error("Couldn't match your location to a city we serve.");
      onCity(best.item.city);
      setNote(best.km > 60 ? `Nearest city we serve: ${best.item.city} (${Math.round(best.km)} km)` : `From ${best.item.city}`);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" onClick={find} disabled={busy} className="inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold text-brand ring-1 ring-brand/30 transition hover:ring-brand">
        <LocateFixed className="h-3.5 w-3.5" aria-hidden /> {busy ? "Finding you…" : "Near me"}
      </button>
      {note && <span className="text-slate-500">{note}</span>}
    </>
  );
}

export default function SearchBox({
  cities,
  initialTab = "seats",
  initial = {},
  variant = "hero",
}: {
  cities: string[];
  initialTab?: "seats" | "hire";
  initial?: SearchInitial;
  variant?: "hero" | "inline";
}) {
  const router = useRouter();
  const pick = (v: string | undefined, fallback: string, alt: string) => (v && cities.includes(v) ? v : cities.includes(fallback) ? fallback : alt);
  const [tab, setTab] = useState(initialTab);
  const [from, setFrom] = useState(pick(initial.from, "Khatima", cities[0] ?? ""));
  const [to, setTo] = useState(pick(initial.to, "Delhi", cities[1] ?? ""));
  const [date, setDate] = useState(initial.date && initial.date >= todayIST() ? initial.date : todayIST());
  const [hireType, setHireType] = useState(initial.hireType ?? "ONE_WAY");
  const [start, setStart] = useState(initial.start ?? tomorrowAt9());
  const [ret, setRet] = useState(initial.ret ?? "");

  const needsDrop = hireType === "ONE_WAY" || hireType === "ROUND_TRIP";
  const hero = variant === "hero";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "seats") {
      router.push(`/search?${new URLSearchParams({ from, to, date })}`);
    } else {
      const q = new URLSearchParams({ type: hireType, pickup: from, start });
      if (needsDrop) q.set("drop", to);
      if (hireType === "ROUND_TRIP" && ret) q.set("return", ret);
      router.push(`/hire?${q}`);
    }
  }

  const field = "group relative flex min-h-[84px] flex-1 flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-brand/60 hover:bg-brand-light/30 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15";
  const fieldLabel = "flex items-center gap-1.5 text-xs font-semibold text-slate-500";

  const cityField = (value: string, onChange: (v: string) => void, label: string, extra = "") => (
    <label className={`${field} ${extra}`}>
      <span className={fieldLabel}>
        <Icon3D name="pin" className="h-4 w-4" /> {label}
      </span>
      <span className="mt-0.5 truncate text-2xl leading-tight font-extrabold text-ink">{value || "Select city"}</span>
      <span className="truncate text-xs text-slate-500">{value ? cityState(value) : ""}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {cities.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    </label>
  );

  const dateField = (label: string, parts: { big: string; small: string }, input: React.ReactNode) => (
    <label className={field}>
      <span className={fieldLabel}>
        <Icon3D name="calendar" className="h-4 w-4" /> {label}
      </span>
      <span className="mt-0.5 truncate text-2xl leading-tight font-extrabold text-ink">{parts.big}</span>
      <span className="truncate text-xs text-slate-500">{parts.small}</span>
      {input}
    </label>
  );

  const overlayInput = "absolute inset-0 h-full w-full cursor-pointer opacity-0";

  return (
    <div className={`relative ${hero ? "pt-0" : ""}`}>
      <div className="relative z-10 flex">
        <div role="tablist" aria-label="Booking type" className="flex rounded-t-2xl bg-white p-1.5 pb-0 shadow-[0_-6px_20px_rgb(15_23_42/0.08)]">
          {(
            [
              { id: "seats", icon: "seat", label: "Shared seat", sub: "Per seat, fixed timings" },
              { id: "hire", icon: "car", label: "Full cab", sub: "Whole car, your timing" },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-2.5 rounded-t-xl px-4 py-3 text-left transition sm:px-6 ${
                  active ? "text-brand" : "text-slate-500 hover:text-ink"
                }`}
              >
                <span className={`grid h-10 w-10 place-items-center rounded-xl transition ${active ? "bg-brand-light ring-2 ring-brand/40" : "bg-slate-100 grayscale-[35%]"}`}>
                  <Icon3D name={t.icon} className="h-7 w-7" />
                </span>
                <span>
                  <span className="block text-sm font-bold">{t.label}</span>
                  <span className="hidden text-[11px] font-medium text-slate-400 sm:block">{t.sub}</span>
                </span>
                {active && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-brand" />}
              </button>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={submit}
        className={`relative rounded-2xl rounded-tl-none bg-white px-4 pt-5 sm:px-6 ${hero ? "pb-10 shadow-[var(--shadow-widget)] sm:pb-12" : "pb-5 shadow-[var(--shadow-soft)] ring-1 ring-slate-200/70"}`}
      >
        {tab === "hire" && (
          <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Trip type">
            {HIRE_TYPES.map((t) => {
              const active = hireType === t.id;
              return (
                <label
                  key={t.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition ${
                    active ? "bg-brand-light text-brand ring-brand" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300"
                  }`}
                >
                  <input type="radio" name="hireType" checked={active} onChange={() => setHireType(t.id)} className="sr-only" />
                  <Icon3D name={t.icon} className="h-5 w-5" />
                  {t.label}
                </label>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <div className="relative flex flex-1 flex-col gap-2 sm:flex-row lg:flex-[2]">
            {cityField(from, setFrom, tab === "hire" ? "Pickup city" : "From")}
            {(tab === "seats" || needsDrop) && (
              <>
                <button
                  type="button"
                  aria-label="Swap cities"
                  title="Swap cities"
                  onClick={() => {
                    setFrom(to);
                    setTo(from);
                  }}
                  className="absolute top-1/2 right-6 z-10 grid h-10 w-10 -translate-y-1/2 rotate-90 place-items-center rounded-full bg-white text-brand shadow-md ring-1 ring-slate-200 transition hover:rotate-[270deg] hover:bg-brand hover:text-white sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:rotate-0 sm:hover:rotate-180"
                >
                  <ArrowLeftRight className="h-4 w-4" aria-hidden />
                </button>
                {cityField(to, setTo, tab === "hire" ? "Drop city" : "To", "sm:pl-8")}
              </>
            )}
          </div>

          {tab === "seats" ? (
            <div className="flex flex-1 flex-col gap-2">
              {dateField(
                "Travel date",
                dayParts(date),
                <input type="date" aria-label="Travel date" required min={todayIST()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} onClick={openPicker} className={overlayInput} />,
              )}
            </div>
          ) : (
            <>
              {dateField(
                "Pickup date & time",
                dateTimeParts(start),
                <input type="datetime-local" aria-label="Pickup date and time" required value={start} onChange={(e) => setStart(e.target.value)} onClick={openPicker} className={overlayInput} />,
              )}
              {hireType === "ROUND_TRIP" &&
                dateField(
                  "Return date & time",
                  dateTimeParts(ret),
                  <input type="datetime-local" aria-label="Return date and time" required value={ret} min={start} onChange={(e) => setRet(e.target.value)} onClick={openPicker} className={overlayInput} />,
                )}
            </>
          )}

          {!hero && (
            <button type="submit" className="btn-accent btn-lg lg:w-44">
              <Search className="h-5 w-5" aria-hidden /> Search
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {tab === "seats" && (
            <>
              <span className="text-slate-400">Quick pick:</span>
              {[
                [todayIST(), "Today"],
                [tomorrowIST(), "Tomorrow"],
              ].map(([d, l]) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setDate(d)}
                  className={`rounded-full px-3 py-1 font-semibold ring-1 transition ${date === d ? "bg-brand text-white ring-brand" : "text-slate-600 ring-slate-200 hover:ring-slate-300"}`}
                >
                  {l}
                </button>
              ))}
            </>
          )}
          <NearMe
            cities={cities}
            onCity={(c) => {
              if (c === to) setTo(from);
              setFrom(c);
            }}
          />
        </div>

        {hero && (
          <button
            type="submit"
            className="btn-accent absolute -bottom-7 left-1/2 w-[min(88%,320px)] -translate-x-1/2 rounded-full py-4 text-lg font-extrabold tracking-wide uppercase shadow-xl shadow-accent/30"
          >
            <Search className="h-5 w-5" aria-hidden strokeWidth={3} /> Search
          </button>
        )}
      </form>
    </div>
  );
}
