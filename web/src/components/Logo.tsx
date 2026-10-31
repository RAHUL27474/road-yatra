import Link from "next/link";
import { BRAND } from "@/lib/media";

/** The owner's logo (public/images/brand/jss-logo.webp) on a white badge, so it also reads on the navy footer, sidebar and ticket. */
export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-[22%] bg-white p-[3%] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static image; next/image adds nothing here */}
      <img src={BRAND.logoMark} alt="" className="block h-full w-full object-contain" />
    </span>
  );
}

/** Splits "Jai Shree Shyam Tour & Travels" into a main line and a caption ("Tour & Travels"). */
export function splitBrand(brand: string) {
  const i = brand.search(/\s(Tours?|Travels?)\b/i);
  return i > 0 ? [brand.slice(0, i), brand.slice(i + 1)] : [brand, ""];
}

export default function Logo({ light = false, brand }: { light?: boolean; brand: string }) {
  const [main, caption] = splitBrand(brand);
  return (
    <Link href="/" className="group flex min-w-0 shrink-0 items-center gap-2.5" aria-label={`${brand} home`}>
      <LogoMark className="h-14 w-14 transition group-hover:scale-105 sm:h-[4.25rem] sm:w-[4.25rem]" />
      <span className="min-w-0 leading-none">
        <span className={`block truncate text-[1.15rem] font-extrabold tracking-tight sm:text-xl ${light ? "text-white" : "text-brand"}`}>{main}</span>
        {caption && (
          <span className={`mt-1 block text-[0.7rem] font-bold tracking-[0.18em] uppercase ${light ? "text-gold" : "text-accent"}`}>{caption}</span>
        )}
      </span>
    </Link>
  );
}
