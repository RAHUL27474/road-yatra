import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime } from "@/lib/format";

const STATUS: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-700",
};

export default async function DriversPage() {
  const drivers = await db.driver.findMany({
    include: { user: true, _count: { select: { trips: { where: { status: "COMPLETED" } }, bookings: { where: { status: "COMPLETED" } } } } },
    orderBy: { createdAt: "asc" },
  });
  const pending = drivers.filter((d) => d.status === "PENDING").sort((a, b) => (a.appliedAt?.getTime() ?? 0) - (b.appliedAt?.getTime() ?? 0));
  const others = drivers.filter((d) => d.status !== "PENDING");
  const soon = Date.now() + 30 * 24 * 3600_000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Drivers</h1>
        <Link href="/admin/drivers/new" className="btn-primary">+ Add driver</Link>
      </div>
      <p className="text-sm text-slate-500">
        Drivers can apply themselves in the Road Yatra Driver app (mobile OTP + licence and photo upload). Their application appears below for
        you to approve. You can also add a driver directly with &quot;+ Add driver&quot;.
      </p>

      <div className={`card overflow-x-auto ${pending.length ? "border-l-4 border-amber-500" : ""}`}>
        <h2 className="px-4 pt-3 font-bold">
          Applications waiting for approval <span className="badge ml-1 bg-amber-100 text-amber-800">{pending.length}</span>
        </h2>
        {pending.length === 0 ? (
          <p className="px-4 pb-4 pt-1 text-sm text-slate-400">No new applications.</p>
        ) : (
          <table className="table mt-2">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Mobile</th>
                <th>Licence</th>
                <th>Experience</th>
                <th>Applied</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.map((d) => (
                <tr key={d.id}>
                  <td className="font-semibold">
                    <span className="flex items-center gap-2">
                      {d.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                      )}
                      {d.user.name}
                    </span>
                  </td>
                  <td>{d.user.phone}</td>
                  <td className="font-mono">{d.licenceNo}</td>
                  <td>{d.experienceYears != null ? `${d.experienceYears} yrs` : "—"}</td>
                  <td className="text-xs">{d.appliedAt ? fmtDateTime(d.appliedAt) : "—"}</td>
                  <td>
                    <Link href={`/admin/drivers/${d.id}`} className="btn-primary py-1">Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="px-4 pt-3 font-bold">All drivers</h2>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Mobile</th>
              <th>Licence</th>
              <th>Trips done</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {others.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">No drivers yet.</td>
              </tr>
            )}
            {others.map((d) => (
              <tr key={d.id}>
                <td className="font-semibold">{d.user.name}</td>
                <td>{d.user.phone}</td>
                <td>
                  <span className="font-mono">{d.licenceNo}</span>
                  {d.licenceExpiry && (
                    <p className={`text-xs ${d.licenceExpiry.getTime() < soon ? "font-semibold text-red-600" : "text-slate-500"}`}>valid till {fmtDate(d.licenceExpiry)}</p>
                  )}
                </td>
                <td>{d._count.trips + d._count.bookings}</td>
                <td>
                  <span className={`badge ${STATUS[d.status] ?? ""}`}>{d.status === "APPROVED" ? (d.active ? "ACTIVE" : "INACTIVE") : d.status}</span>
                </td>
                <td>
                  <Link href={`/admin/drivers/${d.id}`} className="font-semibold text-brand">{d.status === "REJECTED" ? "View" : "Edit"}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
