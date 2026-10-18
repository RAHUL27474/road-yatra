"use client";

import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { apiFetch } from "@/lib/client";

const LABELS = ["", "Very poor", "Poor", "Okay", "Good", "Excellent"];

/** One-screen feedback: tap the stars, optionally write a line, send. */
export default function FeedbackForm({ user }: { user: { name: string; phone: string } | null }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError("Please tap the stars to rate us.");
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/feedback", { body: { rating, comment, name, phone, bookingCode: code || undefined, source: "WEB" } });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" aria-hidden />
        <p className="mt-3 text-lg font-bold">Thank you for your feedback!</p>
        <p className="text-sm text-slate-500">It goes straight to our office. Jai Shree Shyam 🙏</p>
      </div>
    );

  const shown = hover || rating;
  return (
    <form onSubmit={send} className="card space-y-5 p-6">
      <div className="text-center">
        <p className="font-semibold text-ink">How was your experience with us?</p>
        <div className="mt-3 flex justify-center gap-2" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={rating === n}
              className="transition hover:scale-110"
            >
              <Star className={`h-10 w-10 ${n <= shown ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} aria-hidden />
            </button>
          ))}
        </div>
        <p className="mt-1 h-5 text-sm font-medium text-amber-700">{LABELS[shown]}</p>
      </div>
      <div>
        <label className="label" htmlFor="fb-comment">
          {rating && rating <= 3 ? "What went wrong? (optional)" : "Anything you'd like to tell us? (optional)"}
        </label>
        <textarea id="fb-comment" className="input" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="fb-name">Name (optional)</label>
          <input id="fb-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="fb-phone">Mobile (optional)</label>
          <input id="fb-phone" className="input" inputMode="numeric" pattern="[6-9][0-9]{9}" title="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="fb-code">Booking ID (optional)</label>
          <input id="fb-code" className="input uppercase" placeholder="RY…" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button className="btn-primary w-full py-3" disabled={busy}>
        {busy ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
