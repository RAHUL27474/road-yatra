"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import SearchBox, { type SearchInitial } from "./SearchBox";

/** Search summary strip with a "Modify" button that opens the search widget inline. */
export default function ModifyBar({
  title,
  subtitle,
  cities,
  initialTab,
  initial,
}: {
  title: React.ReactNode;
  subtitle: string;
  cities: string[];
  initialTab: "seats" | "hire";
  initial: SearchInitial;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-gradient-to-r from-brand-darker via-brand-dark to-brand">
      <div className="container-x py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 text-white">
            <h1 className="truncate text-xl font-extrabold sm:text-2xl">{title}</h1>
            <p className="truncate text-sm text-blue-100">{subtitle}</p>
          </div>
          <button onClick={() => setOpen((o) => !o)} className="btn shrink-0 bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25" aria-expanded={open}>
            {open ? <X className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
            {open ? "Close" : "Modify"}
          </button>
        </div>
        {open && (
          <div className="mt-5">
            <SearchBox cities={cities} initialTab={initialTab} initial={initial} variant="inline" />
          </div>
        )}
      </div>
    </div>
  );
}
