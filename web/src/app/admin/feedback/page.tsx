import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { markFeedbackHandled } from "../actions";

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

/** Feedback from the website / app, and the ratings passengers gave after their trips. */
export default async function FeedbackAdmin() {
  const since = new Date(Date.now() - 90 * 24 * 3600_000);
  const [feedback, rated] = await Promise.all([
    db.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    db.booking.findMany({
      where: { rating: { not: null }, ratedAt: { gte: since } },
      include: { trip: { include: { route: true, driver: { include: { user: true } } } }, driver: { include: { user: true } } },
      orderBy: { ratedAt: "desc" },
      take: 200,
    }),
  ]);
  const all = [...feedback.map((f) => f.rating), ...rated.map((b) => b.rating!)];
  const avg = all.length ? (all.reduce((a, b) => a + b, 0) / all.length).toFixed(1) : "—";
  const open = feedback.filter((f) => !f.handled).length;

  return (
    <div className="space-y-4">
      <h1 className="page-title">Feedback</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Average rating</p>
          <p className="text-2xl font-extrabold text-amber-600">{avg} ★</p>
          <p className="text-xs text-slate-400">{all.length} rating(s)</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">New feedback</p>
          <p className="text-2xl font-extrabold">{open}</p>
          <p className="text-xs text-slate-400">not marked as seen</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Feedback form</p>
          <Link href="/feedback" className="text-sm font-semibold text-brand">/feedback →</Link>
          <p className="text-xs text-slate-400">share this link on WhatsApp</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="px-4 pt-3 font-bold">Feedback form</h2>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>When</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>From</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {feedback.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">No feedback yet.</td>
              </tr>
            )}
            {feedback.map((f) => (
              <tr key={f.id} className={f.handled ? "opacity-60" : ""}>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(f.createdAt)}</td>
                <td className={`whitespace-nowrap ${f.rating <= 2 ? "text-red-600" : "text-amber-600"}`}>{stars(f.rating)}</td>
                <td className="max-w-md text-sm">{f.comment || <span className="text-slate-400">—</span>}</td>
                <td className="text-xs">
                  {f.name || "—"}
                  {f.phone && (
                    <>
                      {" · "}
                      <a href={`tel:${f.phone}`} className="text-brand">{f.phone}</a>
                    </>
                  )}
                  {f.bookingCode && <span className="block font-mono text-slate-500">{f.bookingCode}</span>}
                  <span className="block text-slate-400">{f.source === "APP" ? "App" : "Website"}</span>
                </td>
                <td>
                  <form action={markFeedbackHandled}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="btn-ghost px-2 py-1 text-xs">{f.handled ? "Mark new" : "Mark seen"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="px-4 pt-3 font-bold">Trip ratings (last 90 days)</h2>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>When</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>Trip</th>
              <th>Driver</th>
            </tr>
          </thead>
          <tbody>
            {rated.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">No trip ratings yet.</td>
              </tr>
            )}
            {rated.map((b) => (
              <tr key={b.id}>
                <td className="whitespace-nowrap text-xs">{b.ratedAt ? fmtDateTime(b.ratedAt) : ""}</td>
                <td className={`whitespace-nowrap ${b.rating! <= 2 ? "text-red-600" : "text-amber-600"}`}>{stars(b.rating!)}</td>
                <td className="max-w-md text-sm">{b.ratingComment || <span className="text-slate-400">—</span>}</td>
                <td className="text-xs">
                  <span className="font-mono">{b.code}</span> · {b.trip ? `${b.trip.route.fromCity} → ${b.trip.route.toCity}` : `Full cab ${b.pickupCity ?? ""}`}
                  <span className="block text-slate-500">{b.passengerName}</span>
                </td>
                <td className="text-xs">{(b.trip?.driver ?? b.driver)?.user.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
