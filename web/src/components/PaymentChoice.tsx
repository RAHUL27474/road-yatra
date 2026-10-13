"use client";

import { Banknote, CreditCard } from "lucide-react";

export type Payment = "ONLINE" | "CASH";

/** "Pay online" / "Pay cash to driver" choice. Shows only the methods that are switched on. */
export default function PaymentChoice({ value, onChange, allowCash, allowOnline = true }: { value: Payment; onChange: (p: Payment) => void; allowCash: boolean; allowOnline?: boolean }) {
  if (!allowCash && allowOnline) return null;
  if (allowCash && !allowOnline)
    return (
      <div className="flex items-center gap-3 rounded-xl border-2 border-brand bg-brand-light/60 p-3.5 text-sm">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand text-white">
          <Banknote className="h-5 w-5" aria-hidden />
        </span>
        <span>
          <span className="block font-semibold text-ink">Pay cash to driver</span>
          <span className="text-xs text-slate-500">Your booking is confirmed now. Pay when you board.</span>
        </span>
      </div>
    );
  return (
    <fieldset>
      <legend className="label">Payment</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["ONLINE", CreditCard, "Pay online", "UPI, card, net banking"],
            ["CASH", Banknote, "Cash to driver", "Pay when you board"],
          ] as const
        ).map(([id, Icon, title, sub]) => {
          const active = value === id;
          return (
            <label
              key={id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 text-sm transition ${
                active ? "border-brand bg-brand-light/60" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input type="radio" name="payment" className="sr-only" checked={active} onChange={() => onChange(id)} />
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${active ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{title}</span>
                <span className="text-xs text-slate-500">{sub}</span>
              </span>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${active ? "border-brand" : "border-slate-300"}`} aria-hidden>
                {active && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
