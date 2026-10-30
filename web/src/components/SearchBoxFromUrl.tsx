"use client";

import { useSearchParams } from "next/navigation";
import SearchBox from "./SearchBox";

/**
 * The home page search box, opened on the tab in the address ("/?tab=hire"). Reading the address in the browser
 * keeps the home page itself static (served from the CDN); wrap it in <Suspense> with a plain SearchBox as fallback.
 */
export default function SearchBoxFromUrl({ cities }: { cities: string[] }) {
  const tab = useSearchParams().get("tab") === "hire" ? "hire" : "seats";
  return <SearchBox key={tab} cities={cities} initialTab={tab} />;
}
