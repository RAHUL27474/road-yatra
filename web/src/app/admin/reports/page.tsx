import Link from "next/link";
import { buildReport, REPORTS } from "@/lib/reports";
import { inr, ymd } from "@/lib/format";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ type?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const type = sp.type && REPORTS[sp.type] ? sp.type : "daily";
  const today = ymd(new Date());
  const from = sp.from || `${today.slice(0, 7)}-01`;
  const to = sp.to || today;
  const report = await buildReport(type, from, to);
  const moneyCols = report.columns.map((c) => c.includes("(₹)"));
  const totals = report.columns.map((c, i) =>
    i === 0 ? "Total" : moneyCols[i] || /Bookings|seats|Full cabs|passengers|Cancelled|Invoices|Sold|trips|km/i.test(c) ? report.rows.reduce((n, r) => n + (Number(r[i]) || 0), 0) : "",
  );
  const q = new URLSearchParams({ type, from, to });

  return (
    <div className="space-y-4">
      <h1 className="page-title">Reports</h1>
      <div className="flex flex-wrap gap-1">
        {Object.entries(REPORTS).map(([k, label]) => (
          <Link key={k} href={`/admin/reports?${new URLSearchParams({ type: k, from, to })}`} className={`rounded-full px-3 py-1 text-sm font-semibold ${k === type ? "bg-brand text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            {label}
          </Link>
        ))}
      </div>
      <form className="card flex flex-wrap items-end gap-3 p-3">
        <input type="hidden" name="type" value={type} />
        <div>
          <label className="label">From</label>
          <input type="date" name="from" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" name="to" defaultValue={to} className="input" />
        </div>
        <button className="btn-primary">Show</button>
        <a href={`/admin/reports/export?${q}`} className="btn-ghost">Download CSV (Excel)</a>
      </form>

      <div className="card overflow-x-auto">
        <div className="px-4 py-3">
          <h2 className="font-bold">{report.title}</h2>
          <p className="text-xs text-slate-500">{report.note}</p>
        </div>
        <table className="table">
          <thead>
            <tr>
              {report.columns.map((c) => (
                <th key={c}>{c.replace(" (₹)", "")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={report.columns.length} className="py-6 text-center text-slate-400">No data for this period.</td>
              </tr>
            )}
            {report.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((v, i) => (
                  <td key={i} className={typeof v === "number" ? "text-right" : ""}>{moneyCols[i] && typeof v === "number" ? inr(v) : v}</td>
                ))}
              </tr>
            ))}
            {report.rows.length > 1 && type !== "occupancy" && (
              <tr className="font-bold">
                {totals.map((v, i) => (
                  <td key={i} className={typeof v === "number" ? "text-right" : ""}>{moneyCols[i] && typeof v === "number" ? inr(v) : v}</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
