import Link from "next/link";
import { BRAND } from "@/lib/media";

/** The logo mark: an "S" drawn as a road with the sun at its end (public/images/brand/logo-mark.svg, same as the app). */
export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG; next/image adds nothing here
  return <img src={BRAND.logoMark} alt="" className={`block shrink-0 rounded-[24%] ${className}`} />;
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
      <LogoMark className="h-11 w-11 transition group-hover:scale-105" />
      <span className="min-w-0 leading-none">
        <span className={`block truncate text-[1.15rem] font-extrabold tracking-tight sm:text-xl ${light ? "text-white" : "text-brand"}`}>{main}</span>
        {caption && (
          <span className={`mt-1 block text-[0.7rem] font-bold tracking-[0.18em] uppercase ${light ? "text-gold" : "text-accent"}`}>{caption}</span>
        )}
      </span>
    </Link>
  );
}
