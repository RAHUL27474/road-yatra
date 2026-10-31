/** Colourful 3D icons (Microsoft Fluent Emoji, MIT licence) in public/images/icons, for feature cards and tabs. */
export type Icon3DName =
  | "calendar"
  | "car"
  | "card"
  | "clock"
  | "driver"
  | "globe"
  | "night"
  | "phone"
  | "pin"
  | "plane"
  | "repeat"
  | "road"
  | "search"
  | "seat"
  | "shield"
  | "smile"
  | "stopwatch"
  | "taxi"
  | "wrench";

export default function Icon3D({ name, className = "h-8 w-8" }: { name: Icon3DName; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- tiny static images; next/image adds nothing here
  return <img src={`/images/icons/${name}.webp`} alt="" width={128} height={128} loading="lazy" decoding="async" className={`shrink-0 select-none ${className}`} draggable={false} />;
}
