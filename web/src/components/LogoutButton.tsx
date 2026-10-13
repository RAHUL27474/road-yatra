"use client";

export default function LogoutButton() {
  return (
    <button
      className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
      }}
    >
      Logout
    </button>
  );
}
