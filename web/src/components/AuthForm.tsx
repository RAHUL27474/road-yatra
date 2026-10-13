"use client";

import Link from "next/link";
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
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <h1 className="text-2xl font-bold">{mode === "login" ? "Login or sign up" : "Create your account"}</h1>

        {mode === "login" && otpEnabled && (
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
            {(["otp", "password"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMethod(m);
                  setError("");
                }}
                className={`rounded-md py-2 ${method === m ? "bg-white shadow" : "text-slate-500"}`}
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
              {devOtp && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Test mode (no SMS provider set up): your OTP is {devOtp}</p>}
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

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={busy}>
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
  );
}
