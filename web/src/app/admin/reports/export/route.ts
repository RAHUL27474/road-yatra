import { getRequestUser } from "@/lib/auth";
import { buildReport, REPORTS, toCsv } from "@/lib/reports";

// GET /admin/reports/export?type=daily&from=YYYY-MM-DD&to=YYYY-MM-DD -> CSV download (admin only)
export async function GET(req: Request) {
  const user = await getRequestUser(req); // website cookie, or the app's Bearer token
  if (!user || user.role !== "ADMIN") return new Response("Not authorised", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type") ?? "daily";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!REPORTS[type] || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return new Response("Bad request", { status: 400 });
  const csv = toCsv(await buildReport(type, from, to));
  // BOM so Excel opens the ₹ sign and Hindi names correctly
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="road-yatra-${type}-${from}-to-${to}.csv"` },
  });
}
