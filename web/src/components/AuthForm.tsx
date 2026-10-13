"use client";

import Image from "next/image";
import Link from "next/link";
import { CircleCheck, LogIn, UserPlus } from "lucide-react";
import { HERO_IMAGE } from "@/lib/media";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/client";

export default function AuthForm({ mode, otpEnabled }: { mode: "login" | "register"; otpEnabled: boolean }) {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [method, setMethod] = useState<"otp" | "password">(otpEnabled && mode === "login" ? "otp" : "password");
  const [form, setForm] = useState({ name: "", email: "", phone: "", login: "", password: "", otp: "" });
  const [otpStep, setOtpStep] = useState<"phone" | "code">("phone");
  const [isNewUser, setIsNewUser] = useState(false);
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const done = () => (window.location.href = safeNext); // full reload so the header picks up the session

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (method === "otp" && otpStep === "phone") {
        const r = await apiFetch<{ isNewUser: boolean; devOtp?: string }>("/api/auth/otp/request", { body: { phone: form.phone } });
        setIsNewUser(r.isNewUser);
        setDevOtp(r.devOtp);
        setOtpStep("code");
      } else if (method === "otp") {
        const r = await apiFetch<{ needsName?: boolean }>("/api/auth/otp/verify", {
          body: { phone: form.phone, otp: form.otp, name: form.name || undefined },
        });
        if (r.needsName) setIsNewUser(true);
        else done();
      } else if (mode === "login") {
        await apiFetch("/api/auth/login", { body: { login: form.login, password: form.password } });
        done();
      } else {
        await apiFetch("/api/auth/register", { body: { name: form.name, email: form.email, phone: form.phone, password: form.password } });
        done();
      }
    });
  };

  const phoneInput = (
    <div>
      <label className="label">Mobile number</label>
      <input className="input" required autoFocus inputMode="numeric" pattern="[6-9][0-9]{9}" title="10-digit mobile number" value={form.phone} onChange={set("phone")} />
    </div>
  );

  return (
    <div className="container-x py-8 sm:py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-lift)] ring-1 ring-slate-200/70 lg:grid-cols-2">
      <div className="relative hidden min-h-[520px] lg:block">
        <Image src={HERO_IMAGE} alt="Hill highway in Uttarakhand" fill sizes="520px" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/40 to-slate-900/10" />
        <div className="absolute inset-x-0 bottom-0 p-8 text-white">
          <p className="text-2xl leading-snug font-extrabold">Khatima se Delhi – Seat bhi book karein, Puri Cab bhi.</p>
          <ul className="mt-5 space-y-2 text-sm text-slate-200">
            {["Manage your bookings and e-tickets", "Track your vehicle live", "Download GST invoices"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 text-orange-300" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-5 p-6 sm:p-10">
        <div>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-light text-brand">
            {mode === "login" ? <LogIn className="h-6 w-6" aria-hidden /> : <UserPlus className="h-6 w-6" aria-hidden />}
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-ink">{mode === "login" ? "Login or sign up" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-slate-500">{mode === "login" ? "Use your mobile number to continue." : "It takes less than a minute."}</p>
        </div>

        {mode === "login" && otpEnabled && (
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            {(["otp", "password"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMethod(m);
                  setError("");
                }}
                className={`rounded-lg py-2 transition ${method === m ? "bg-white text-brand shadow" : "text-slate-500 hover:text-ink"}`}
              >
                {m === "otp" ? "Mobile OTP" : "Password"}
              </button>
            ))}
          </div>
        )}

        {method === "otp" ? (
          otpStep === "phone" ? (
            phoneInput
          ) : (
            <>
              <p className="text-sm text-slate-500">
                OTP sent to <b>{form.phone}</b>.{" "}
                <button type="button" className="font-semibold text-brand" onClick={() => setOtpStep("phone")}>
                  Change
                </button>
              </p>
              {devOtp && <p className="rounded-xl bg-amber-50 p-2 text-xs text-amber-800">Test mode (no SMS provider set up): your OTP is {devOtp}</p>}
              <div>
                <label className="label">6-digit OTP</label>
                <input className="input text-center text-xl tracking-[0.5em]" required autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.otp} onChange={set("otp")} />
              </div>
              {isNewUser && (
                <div>
                  <label className="label">Your full name</label>
                  <input className="input" required value={form.name} onChange={set("name")} />
                </div>
              )}
            </>
          )
        ) : mode === "register" ? (
          <>
            <div>
              <label className="label">Full name</label>
              <input className="input" required value={form.name} onChange={set("name")} />
            </div>
            {phoneInput}
            <div>
              <label className="label">Email (optional)</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} />
            </div>
          </>
        ) : (
          <div>
            <label className="label">Email or mobile number</label>
            <input className="input" required autoFocus value={form.login} onChange={set("login")} />
          </div>
        )}

        {method === "password" && (
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required minLength={mode === "register" ? 6 : 1} value={form.password} onChange={set("password")} />
          </div>
        )}

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button className="btn-primary btn-lg w-full" disabled={busy}>
          {busy ? "Please wait…" : method === "otp" ? (otpStep === "phone" ? "Send OTP" : "Verify & continue") : mode === "login" ? "Login" : "Create account"}
        </button>
        {method === "password" && (
          <p className="text-center text-sm text-slate-500">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <Link href={`${mode === "login" ? "/register" : "/login"}?next=${encodeURIComponent(safeNext)}`} className="font-semibold text-brand">
              {mode === "login" ? "Create an account" : "Login"}
            </Link>
          </p>
        )}
      </form>
      </div>
    </div>
  );
}
