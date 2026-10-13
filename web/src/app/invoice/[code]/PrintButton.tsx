"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button className="btn-primary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden /> Print / Save as PDF
    </button>
  );
}
