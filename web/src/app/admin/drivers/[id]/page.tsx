import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, ymd } from "@/lib/format";
import { privateFileUrl } from "@/lib/uploads";
import Flash from "@/components/Flash";
import { removeDriver, reviewDriverApplication, saveDriver } from "../../actions";

const STATUS: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-700",
};

export default async function DriverForm({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; reviewed?: string }> }) {
  const [{ id }, { error, reviewed }] = await Promise.all([params, searchParams]);
  const d = id === "new" ? null : await db.driver.findUnique({ where: { id }, include: { user: true } });
  if (id !== "new" && !d) notFound();

  const docs: [string, string | null][] = d
    ? [
        ["Photo", d.photoUrl],
        ["Driving licence", d.licencePhoto ? privateFileUrl(d.licencePhoto) : null],
        ["Aadhaar", d.aadhaarPhoto ? privateFileUrl(d.aadhaarPhoto) : null],
      ]
    : [];
  const details: [string, string][] = d
    ? [
        ["Mobile (OTP verified)", d.user.phone],
        ["Licence", `${d.licenceNo}${d.licenceExpiry ? ` · valid till ${fmtDate(d.licenceExpiry)}` : ""}`],
        ["Experience", d.experienceYears != null ? `${d.experienceYears} years` : "—"],
        ["Aadhaar (last 4)", d.aadhaarLast4 ? `XXXX XXXX ${d.aadhaarLast4}` : "—"],
        ["Emergency contact", d.emergencyContact || "—"],
        ["Address", d.address || "—"],
        ["Applied", d.appliedAt ? fmtDateTime(d.appliedAt) : "—"],
        ["Reviewed", d.reviewedAt ? fmtDateTime(d.reviewedAt) : "—"],
      ]
    : [];
  const title = !d ? "Add driver" : d.status === "PENDING" ? `Driver application: ${d.user.name}` : `Edit ${d.user.name}`;
  const success =
    reviewed === "approve" ? "Approved. The driver can now log in to the driver app." : reviewed === "reject" ? "Application rejected. The driver has been informed on WhatsApp." : undefined;

  return (
    <div className="space-y-4">
      <h1 className="page-title">{title}</h1>
      <Flash error={error} success={success} />

      {d?.appliedAt && (
        <section className={`card space-y-4 p-5 ${d.status === "PENDING" ? "border-l-4 border-amber-500" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Application from the driver app</h2>
            <span className={`badge ${STATUS[d.status] ?? ""}`}>{d.status}</span>
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {d.rejectReason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Rejected: {d.rejectReason}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            {docs.map(([label, url]) => (
              <div key={label}>
                <p className="label">{label}</p>
                {url ? (
                  <a href={url} target="_blank" className="block overflow-hidden rounded-lg ring-1 ring-slate-200" title="Open full size">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={label} className="h-48 w-full object-cover" />
                  </a>
                ) : (
                  <p className="grid h-48 place-items-center rounded-lg bg-slate-50 text-sm text-slate-400">Not uploaded</p>
                )}
              </div>
            ))}
          </div>
          {d.status === "PENDING" && (
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <form action={reviewDriverApplication}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="decision" value="approve" />
                <button className="btn bg-green-600 px-6 text-white hover:bg-green-700">✓ Approve driver</button>
              </form>
              <form action={reviewDriverApplication} className="flex flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="decision" value="reject" />
                <input name="reason" className="input max-w-sm" placeholder="Reason, e.g. licence photo not clear" required minLength={3} />
                <button className="btn-ghost text-red-600">Reject</button>
              </form>
            </div>
          )}
        </section>
      )}

      <form action={saveDriver} className="space-y-4">
        <input type="hidden" name="id" value={d?.id ?? ""} />
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">{d ? "Driver details" : "New driver (approved immediately)"}</h2>
          <div>
            <label className="label">Full name</label>
            <input name="name" className="input" required defaultValue={d?.user.name} />
          </div>
          <div>
            <label className="label">Mobile number (driver app login)</label>
            <input name="phone" className="input" required inputMode="numeric" pattern="[6-9][0-9]{9}" defaultValue={d?.user.phone} />
          </div>
          <div>
            <label className="label">Driving licence number</label>
            <input name="licenceNo" className="input" required defaultValue={d?.licenceNo} />
          </div>
          <div>
            <label className="label">Licence valid till</label>
            <input name="licenceExpiry" type="date" className="input" defaultValue={ymd(d?.licenceExpiry)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Photo (shown to passengers and on the website)</label>
            <div className="flex flex-wrap items-center gap-3">
              {d?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-200" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-xs text-slate-400">No photo</span>
              )}
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
              {d?.photoUrl ? (
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <input type="checkbox" name="removePhoto" className="accent-brand" /> remove photo
                </label>
              ) : null}
              <input type="hidden" name="photoUrl" value={d?.photoUrl ?? ""} />
            </div>
          </div>
          <div>
            <label className="label">{d ? "New password (leave empty to keep)" : "Password (optional — OTP login works without it)"}</label>
            <input name="password" type="password" className="input" minLength={6} autoComplete="new-password" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes (PAN on file, police verification, etc.)</label>
            <textarea name="notes" className="input" rows={2} defaultValue={d?.notes} />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="active" defaultChecked={d?.active ?? true} className="h-4 w-4 accent-brand" /> Active (can be assigned trips)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="showOnWebsite" defaultChecked={d?.showOnWebsite ?? true} className="h-4 w-4 accent-brand" /> Show photo &amp; name in “Our drivers” (website and app)
          </label>
        </section>
        <button className="btn-primary px-8 py-3">Save driver</button>
      </form>

      {d && (
        <form action={removeDriver} className="card flex flex-wrap items-center justify-between gap-3 border-l-4 border-red-500 p-4">
          <input type="hidden" name="id" value={d.id} />
          <p className="text-sm text-slate-600">
            <b className="text-red-700">Remove driver.</b> A driver with past trips is switched off and hidden (records are kept); upcoming duties go back to
            “No driver”. A driver with no trips is deleted.
          </p>
          <button className="rounded-lg border border-red-600 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Remove driver</button>
        </form>
      )}
    </div>
  );
}
