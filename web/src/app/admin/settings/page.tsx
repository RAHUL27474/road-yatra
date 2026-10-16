import { getSettings } from "@/lib/settings";
import { isDemoPayments } from "@/lib/payment";
import { otpAvailable } from "@/lib/otp";
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
      <h1 className="page-title">Settings</h1>
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
          Online payments: {isDemoPayments() ? <b className="text-amber-700">not set up (add Razorpay keys)</b> : <b className="text-green-700">Razorpay connected</b>} · Mobile
          OTP: {otpAvailable("PHONE") && process.env.OTP_DEV_MODE !== "true" ? <b className="text-green-700">connected</b> : <b className="text-amber-700">not set up</b>}
        </p>
        <label className="block max-w-xs text-sm font-medium">
          Advance per seat (₹), paid online to hold a seat
          <input name="advancePerSeat" type="number" min={0} step={10} defaultValue={s.advancePerSeat} className="input mt-1" />
          <span className="text-xs font-normal text-slate-500">Needs Razorpay. The rest is paid in cash to the driver. 0 = off.</span>
        </label>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Passenger benefits</h2>
        <label className="text-sm font-medium">
          Return-trip discount (%)
          <input name="returnDiscountPercent" type="number" min={0} max={50} step={1} defaultValue={s.returnDiscountPercent} className="input mt-1" />
          <span className="text-xs font-normal text-slate-500">Off the fare when the customer already has the onward trip within 15 days. 0 = off.</span>
        </label>
        <label className="text-sm font-medium">
          Free change of date / pickup, up to (hours before departure)
          <input name="freeChangeHours" type="number" min={0} max={72} step={1} defaultValue={s.freeChangeHours} className="input mt-1" />
          <span className="text-xs font-normal text-slate-500">One free date change per booking. 0 = off.</span>
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Luggage, children &amp; pets (one rule per line)
          <textarea name="travelPolicy" rows={5} defaultValue={s.travelPolicy} className="input mt-1" />
          <span className="text-xs font-normal text-slate-500">Shown on the seat screen, before booking and on the ticket.</span>
        </label>
      </section>

      <button className="btn-primary px-8 py-3">Save settings</button>
    </form>
  );
}
