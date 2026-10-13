import { CircleCheck, Luggage, Music, Plug, Snowflake, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  ac: Snowflake,
  music: Music,
  "charging point": Plug,
  charging: Plug,
  "extra luggage": Luggage,
  luggage: Luggage,
};

export function amenityIcon(name: string): LucideIcon {
  return ICONS[name.trim().toLowerCase()] ?? CircleCheck;
}

/** Amenity chips with icons (AC, Music, Charging Point...). */
export default function Amenities({ items, compact = false }: { items: string[]; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((a) => {
        const Icon = amenityIcon(a);
        return (
          <li key={a} className="chip" title={a}>
            <Icon className="h-3.5 w-3.5 text-brand" aria-hidden />
            {compact ? <span className="sr-only sm:not-sr-only">{a}</span> : a}
          </li>
        );
      })}
    </ul>
  );
}
