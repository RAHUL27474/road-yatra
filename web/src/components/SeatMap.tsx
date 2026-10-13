"use client";

type Props = {
  seats: number;
  seatsPerRow: number;
  aisleAfter: number;
  taken: number[];
  selected: number[];
  onToggle: (seat: number) => void;
};

/** Draws seats 1..n in rows, with an optional aisle gap. */
export default function SeatMap({ seats, seatsPerRow, aisleAfter, taken, selected, onToggle }: Props) {
  const rows: number[][] = [];
  for (let s = 1; s <= seats; s += seatsPerRow) rows.push(Array.from({ length: Math.min(seatsPerRow, seats - s + 1) }, (_, i) => s + i));

  return (
    <div className="inline-block rounded-2xl border-2 border-slate-300 bg-slate-50 p-4">
      <div className="mb-3 flex justify-end border-b border-slate-200 pb-2 text-xs text-slate-400">
        <span title="Driver">🛞 Driver</span>
      </div>
      <div className="space-y-2">
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-2">
            {row.map((seat, i) => {
              const isTaken = taken.includes(seat);
              const isSelected = selected.includes(seat);
              return (
                <div key={seat} className="flex gap-2">
                  {aisleAfter > 0 && i === aisleAfter && <div className="w-6" />}
                  <button
                    type="button"
                    disabled={isTaken}
                    onClick={() => onToggle(seat)}
                    aria-label={`Seat ${seat}${isTaken ? " (booked)" : ""}`}
                    className={`grid h-11 w-11 place-items-center rounded-t-lg rounded-b-md border-2 text-sm font-semibold transition ${
                      isTaken
                        ? "cursor-not-allowed border-slate-300 bg-slate-300 text-slate-500"
                        : isSelected
                          ? "border-green-600 bg-green-500 text-white"
                          : "border-green-500 bg-white text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {seat}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded border-2 border-green-500 bg-white" /> Available</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-green-500" /> Selected</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-slate-300" /> Booked</span>
      </div>
    </div>
  );
}
