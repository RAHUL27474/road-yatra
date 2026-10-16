import { db } from "./db";
import { seatRows } from "./seats";

/**
 * Women's seat rule (like AbhiBus "Pink Seat" / zingbus women zones): a seat right next to a seat booked
 * by a woman — same row, neighbouring position — can only be booked for a woman.
 */
export function womenOnlySeats(v: { seats: number; seatsPerRow: number; seatLayout?: string | null }, femaleSeats: number[]): number[] {
  const female = new Set(femaleSeats);
  const out = new Set<number>();
  for (const row of seatRows(v.seats, v.seatsPerRow, v.seatLayout)) {
    row.forEach((seat, i) => {
      if (!female.has(seat)) return;
      for (const n of [row[i - 1], row[i + 1]]) if (n != null && !female.has(n)) out.add(n);
    });
  }
  return [...out].sort((a, b) => a - b);
}

/** Seats booked by women on a trip, and the seats next to them that only a woman may book. */
export async function womenSeatInfo(tripId: string, vehicle: { seats: number; seatsPerRow: number; seatLayout: string }) {
  const femaleSeats = (await db.bookedSeat.findMany({ where: { tripId, female: true }, select: { seatNo: true } })).map((s) => s.seatNo);
  return { femaleSeats, womenOnlySeats: womenOnlySeats(vehicle, femaleSeats), womenBooked: femaleSeats.length };
}
