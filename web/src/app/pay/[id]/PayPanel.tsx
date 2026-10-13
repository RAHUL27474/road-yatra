"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { inr } from "@/lib/format";

type Props = {
  bookingId: string;
  payToken?: string;
  amount: number;
  expiresAt: string;
  demo: boolean;
  confirmUrl: string;
  prefill: { name: string; contact: string };
};

type StartRes = { mode: "DEMO" } | { mode: "RAZORPAY"; keyId: string; orderId: string; amountPaise: number; code: string };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment window. Check your internet connection."));
    document.body.appendChild(s);
  });
}

export default function PayPanel({ bookingId, payToken, amount, expiresAt, demo, confirmUrl, prefill }: Props) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const confirm = async (extra: Record<string, string> = {}) => {
    await apiFetch(`/api/bookings/${bookingId}/confirm-payment`, { body: { payToken, ...extra } });
    window.location.href = confirmUrl;
  };

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const start = await apiFetch<StartRes>(`/api/bookings/${bookingId}/pay`, { body: { payToken } });
      if (start.mode === "DEMO") return await confirm();

      await loadRazorpay();
      const rzp = new window.Razorpay!({
        key: start.keyId,
        order_id: start.orderId,
        amount: start.amountPaise,
        currency: "INR",
        name: process.env.NEXT_PUBLIC_BRAND_NAME || "Road Yatra",
        description: `Booking ${start.code}`,
        prefill,
        theme: { color: "#0b5ed7" },
        handler: (r: Record<string, string>) => confirm(r).catch((e) => setError(e.message)),
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", () => {
        setError("Payment failed. You can try again.");
        setBusy(false);
      });
      rzp.open();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-500">Amount to pay</p>
        <p className="text-3xl font-extrabold">{inr(amount)}</p>
      </div>
      <p className={`rounded-lg p-3 text-sm ${left < 120000 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
        {left > 0 ? (
          <>
            Complete payment in <b>{mins}:{secs.toString().padStart(2, "0")}</b> or your booking will be released.
          </>
        ) : (
          "Time is up. Refresh the page to check the booking status."
        )}
      </p>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button onClick={pay} disabled={busy || left === 0} className="btn-accent w-full py-3 text-base">
        {busy ? "Processing…" : demo ? `Pay ${inr(amount)} (demo)` : `Pay ${inr(amount)}`}
      </button>
      {demo ? (
        <p className="text-xs text-slate-400">Demo mode: no money is charged. Add Razorpay keys in .env to take real payments.</p>
      ) : (
        <p className="text-xs text-slate-400">Secure payment by Razorpay. UPI, cards, net banking and wallets accepted.</p>
      )}
    </div>
  );
}
