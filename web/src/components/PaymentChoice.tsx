"use client";

export type Payment = "ONLINE" | "CASH";

/** "Pay online" / "Pay cash to driver" radio pair. Renders nothing when cash is switched off. */
export default function PaymentChoice({ value, onChange, allowCash }: { value: Payment; onChange: (p: Payment) => void; allowCash: boolean }) {
  if (!allowCash) return null;
  return (
    <div>
      <label className="label">Payment</label>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["ONLINE", "💳 Pay online", "UPI, card, net banking"],
            ["CASH", "💵 Cash to driver", "Pay when you board"],
          ] as const
        ).map(([id, title, sub]) => (
          <label
            key={id}
            className={`cursor-pointer rounded-lg border-2 p-3 text-sm ${value === id ? "border-brand bg-brand-light" : "border-slate-200 hover:border-slate-300"}`}
          >
            <input type="radio" name="payment" className="sr-only" checked={value === id} onChange={() => onChange(id)} />
            <span className="block font-semibold">{title}</span>
            <span className="text-xs text-slate-500">{sub}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
