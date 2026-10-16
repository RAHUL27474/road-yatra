"use client";

import { Check } from "lucide-react";
import { seatRows } from "@/lib/seats";

type Props = {
  seats: number;
  seatsPerRow: number;
  aisleAfter: number;
  /** Seats per row, front to back, e.g. "1,3,2". */
  seatLayout?: string;
  /** Seats booked by women (pink), and free seats next to them that only a woman may book. */
  femaleSeats?: number[];
  womenOnly?: number[];
  taken: number[];
  selected: number[];
  onToggle: (seat: number) => void;
};

function SteeringWheel({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 14.5V21M9.6 11.2 3.4 9.5M14.4 11.2l6.2-1.7" />
    </svg>
  );
}

export function SeatLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-4 w-4 rounded-md border-2 border-green-500 bg-white" /> Available
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-4 w-4 rounded-md border-2 border-brand bg-brand" /> Selected
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-4 w-4 rounded-md border-2 border-slate-300 bg-slate-200" /> Booked
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-4 w-4 rounded-md border-2 border-pink-400 bg-pink-50" /> Women only
      </span>
    </div>
  );
}

/**
 * Top-down car layout: driver at the front right, then seats 1..n in rows, with an optional aisle gap.
 * A single front seat (Ertiga, Dzire) sits next to the driver.
 */
export default function SeatMap({ seats, seatsPerRow, aisleAfter, seatLayout, femaleSeats = [], womenOnly = [], taken, selected, onToggle }: Props) {
  const all = seatRows(seats, seatsPerRow, seatLayout);
  const frontSeat = all.length > 1 && all[0].length === 1 ? all[0][0] : null;
  const rows = frontSeat ? all.slice(1) : all;

  const seatButton = (seat: number) => {
    const isTaken = taken.includes(seat);
    const isSelected = selected.includes(seat);
    const isWomenOnly = !isTaken && !isSelected && womenOnly.includes(seat);
    const byWoman = isTaken && femaleSeats.includes(seat);
    return (
      <button
        type="button"
        disabled={isTaken}
        onClick={() => onToggle(seat)}
        aria-pressed={isSelected}
        aria-label={`Seat ${seat}${seat === frontSeat ? " (front, next to driver)" : ""}${isTaken ? " (booked)" : isSelected ? " (selected)" : isWomenOnly ? " (women only)" : ""}`}
        className={`relative grid h-14 w-12 place-items-center rounded-t-xl rounded-b-lg border-2 pt-1 text-sm font-bold transition ${
          byWoman
            ? "cursor-not-allowed border-pink-300 bg-pink-100 text-pink-400"
            : isTaken
              ? "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-400"
              : isSelected
                ? "border-brand bg-brand text-white shadow-md shadow-brand/30"
                : isWomenOnly
                  ? "border-pink-400 bg-pink-50 text-pink-700 hover:-translate-y-0.5"
                  : "border-green-500 bg-white text-green-700 hover:-translate-y-0.5 hover:bg-green-50"
        }`}
      >
        {/* headrest */}
        <span
          className={`absolute top-1 left-1/2 h-1.5 w-6 -translate-x-1/2 rounded-full ${isTaken ? "bg-slate-300" : isSelected ? "bg-white/50" : "bg-green-200"}`}
          aria-hidden
        />
        {seat}
        {isSelected && (
          <span className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-accent text-white ring-2 ring-white">
            <Check className="h-2.5 w-2.5" strokeWidth={4} aria-hidden />
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="relative inline-block rounded-[2.75rem] border-[3px] border-slate-300 bg-gradient-to-b from-slate-50 to-white px-5 pt-4 pb-6 shadow-inner">
      {/* windscreen */}
      <div className="mx-auto mb-4 h-3 w-3/4 rounded-b-[999px] rounded-t-md bg-gradient-to-b from-sky-200 to-sky-100" aria-hidden />
      <div className="mb-4 flex items-center justify-between border-b border-dashed border-slate-300 pb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
        {frontSeat ? seatButton(frontSeat) : <span>Front</span>}
        <span className="flex items-center gap-1.5 text-slate-500" title="Driver">
          Driver
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-200 text-slate-500">
            <SteeringWheel className="h-6 w-6" />
          </span>
        </span>
      </div>
      <div className="space-y-3">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-2.5">
            {row.map((seat, i) => (
              <div key={seat} className="flex gap-2.5">
                {aisleAfter > 0 && i === aisleAfter && <div className="w-6" aria-hidden />}
                {seatButton(seat)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
