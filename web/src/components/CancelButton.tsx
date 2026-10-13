"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";
import { inr } from "@/lib/format";

export default function CancelButton({ bookingId, refund, charge, paid }: { bookingId: string; refund: number; charge: number; paid: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const message = paid
    ? `Cancel this booking?\n\nCancellation charge: ${inr(charge)}\nRefund: ${inr(refund)}`
    : "Cancel this booking?";
  return (
    <button
      className="btn-ghost text-red-600"
      disabled={busy}
      onClick={async () => {
        if (!confirm(message)) return;
        setBusy(true);
        try {
          await apiFetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
          router.refresh();
        } catch (e) {
          alert((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Cancelling…" : "Cancel booking"}
    </button>
  );
}
