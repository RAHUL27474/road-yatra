// Same logic as web/src/lib/seats.ts (the server and website use that copy).
/**
 * Seat numbers grouped into rows, front to back.
 * `layout` lists seats per row ("1,3,2" = 1 next to the driver, 3 in the middle, 2 at the back). When it is
 * empty or doesn't add up to `seats`, the vehicle is drawn as a plain grid of `seatsPerRow`.
 */
export function seatRows(seats: number, seatsPerRow: number, layout?: string | null): number[][] {
  const sizes = parseSeatLayout(layout);
  const counts = sizes && sizes.reduce((a, b) => a + b, 0) === seats ? sizes : null;
  const rows: number[][] = [];
  let n = 1;
  if (counts) {
    for (const c of counts) {
      rows.push(Array.from({ length: c }, (_, i) => n + i));
      n += c;
    }
    return rows;
  }
  const per = Math.max(1, seatsPerRow);
  for (; n <= seats; n += per) rows.push(Array.from({ length: Math.min(per, seats - n + 1) }, (_, i) => n + i));
  return rows;
}

/** "1, 3, 2" → [1, 3, 2]; anything else → null. */
export function parseSeatLayout(layout?: string | null): number[] | null {
  if (!layout?.trim()) return null;
  const parts = layout.split(",").map((p) => Number(p.trim()));
  return parts.length && parts.every((p) => Number.isInteger(p) && p > 0 && p <= 6) ? parts : null;
}
