import { getSettings } from "@/lib/settings";
import { isDemoPayments } from "@/lib/payment";
import { smsConfigured } from "@/lib/notify";
import Flash from "@/components/Flash";
import { saveSettings } from "../actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const s = await getSettings();
  const slabs = [...s.cancellationSlabs, ...Array(5).fill(null)].slice(0, 5);
  const field = (name: string, label: string, value: string, hint?: string) => (
    <div>
      <label className="label">{label}</label>
      <input name={name} defaultValue={value} className="input" />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );

  return (
    <form action={saveSettings} className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Flash success={saved ? "Settings saved." : undefined} />

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Business details (printed on tax invoices)</h2>
        {field("legalName", "Legal business name", s.business.legalName)}
        {field("gstin", "GSTIN", s.business.gstin, "Leave empty if not GST-registered yet")}
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <textarea name="address" defaultValue={s.business.address} rows={2} className="input" />
        </div>
        {field("stateName", "State", s.business.stateName)}
        {field("stateCode", "State code", s.business.stateCode, "Uttarakhand = 05")}
        {field("sacCode", "SAC code", s.business.sacCode, "Confirm the exact SAC and GST rate with your CA")}
        {field("email", "Billing email", s.business.email)}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">Cancellation &amp; refund rules</h2>
        <p className="text-sm text-slate-500">
          Refund of the fare + GST when the customer cancels online. Toll &amp; parking are always refunded. Example: 24 h or more before → 100%,
          2–24 h → 50%, under 2 h → 0%. Leave rows empty to remove them. You can override the refund when cancelling from Admin → Bookings.
        </p>
        <div className="max-w-md space-y-2">
          {slabs.map((slab, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              If cancelled at least
              <input name={`slabHours${i}`} type="number" min={0} step="0.5" defaultValue={slab?.minHoursBefore ?? ""} className="input w-20 py-1" />
              hours before → refund
              <input name={`slabRefund${i}`} type="number" min={0} max={100} defaultValue={slab?.refundPercent ?? ""} className="input w-20 py-1" />%
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="font-bold">Payments</h2>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="allowCash" defaultChecked={s.allowCash} className="h-4 w-4 accent-brand" />
          Let customers choose &quot;Pay cash to driver&quot; (booking is confirmed without online payment)
        </label>
        <p className="text-sm text-slate-500">
          Online payments: {isDemoPayments() ? <b className="text-amber-700">demo mode (add Razorpay keys in .env)</b> : <b className="text-green-700">Razorpay connected</b>} · SMS
          OTP: {smsConfigured() ? <b className="text-green-700">connected</b> : <b className="text-amber-700">not set up</b>}
        </p>
      </section>

      <button className="btn-primary px-8 py-3">Save settings</button>
    </form>
  );
}
