"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const tomorrowAt9 = () => {
  const d = new Date(Date.now() + 24 * 3600_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return `${d}T09:00`;
};

const HIRE_TYPES = [
  { id: "ONE_WAY", label: "One Way" },
  { id: "ROUND_TRIP", label: "Round Trip" },
  { id: "LOCAL", label: "Local" },
  { id: "AIRPORT", label: "Airport" },
];

export default function SearchBox({ cities, initialTab = "seats" }: { cities: string[]; initialTab?: "seats" | "hire" }) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [from, setFrom] = useState(cities.includes("Khatima") ? "Khatima" : cities[0] ?? "");
  const [to, setTo] = useState(cities.includes("Delhi") ? "Delhi" : cities[1] ?? "");
  const [date, setDate] = useState(todayIST());
  const [hireType, setHireType] = useState("ONE_WAY");
  const [start, setStart] = useState(tomorrowAt9());
  const [ret, setRet] = useState("");

  const needsDrop = hireType === "ONE_WAY" || hireType === "ROUND_TRIP";

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

  const citySelect = (value: string, onChange: (v: string) => void, label: string) => (
    <div className="flex-1 rounded-lg border border-slate-200 px-4 py-3 hover:border-brand">
      <label className="label">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-xl font-bold outline-none">
        {cities.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="relative">
      <div className="absolute -top-6 left-1/2 z-10 flex -translate-x-1/2 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200">
        {[
          { id: "seats", icon: "💺", label: "Book Seats" },
          { id: "hire", icon: "🚗", label: "Hire a Vehicle" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as "seats" | "hire")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold ${tab === t.id ? "bg-brand-light text-brand" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="card px-5 pb-10 pt-12">
        {tab === "hire" && (
          <div className="mb-4 flex flex-wrap gap-4">
            {HIRE_TYPES.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="radio" name="hireType" checked={hireType === t.id} onChange={() => setHireType(t.id)} className="accent-brand" />
                {t.label}
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row">
          {citySelect(from, setFrom, tab === "hire" ? "Pickup city" : "From")}
          {(tab === "seats" || needsDrop) && (
            <>
              <button
                type="button"
                aria-label="Swap cities"
                onClick={() => {
                  setFrom(to);
                  setTo(from);
                }}
                className="mx-auto -my-5 z-10 grid h-10 w-10 shrink-0 place-items-center self-center rounded-full bg-white text-brand shadow ring-1 ring-slate-200 lg:-mx-5 lg:my-0"
              >
                ⇄
              </button>
              {citySelect(to, setTo, tab === "hire" ? "Drop city" : "To")}
            </>
          )}

          {tab === "seats" ? (
            <div className="flex-1 rounded-lg border border-slate-200 px-4 py-3 hover:border-brand">
              <label className="label">Travel date</label>
              <input type="date" required min={todayIST()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent text-xl font-bold outline-none" />
            </div>
          ) : (
            <>
              <div className="flex-1 rounded-lg border border-slate-200 px-4 py-3 hover:border-brand">
                <label className="label">Pickup date & time</label>
                <input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} className="w-full bg-transparent text-lg font-bold outline-none" />
              </div>
              {hireType === "ROUND_TRIP" && (
                <div className="flex-1 rounded-lg border border-slate-200 px-4 py-3 hover:border-brand">
                  <label className="label">Return date & time</label>
                  <input type="datetime-local" required value={ret} min={start} onChange={(e) => setRet(e.target.value)} className="w-full bg-transparent text-lg font-bold outline-none" />
                </div>
              )}
            </>
          )}
        </div>

        <button type="submit" className="btn-accent absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-full px-14 py-3.5 text-lg uppercase tracking-wide">
          Search
        </button>
      </form>
    </div>
  );
}
