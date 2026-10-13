"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Armchair, CarFront, LayoutDashboard, LogOut, Menu, Phone, Ticket, UserRound, X } from "lucide-react";
import Logo from "./Logo";

type Props = { brand: string; supportPhone: string; user: { firstName: string; isAdmin: boolean } | null };

const NAV = [
  { href: "/?tab=seats#search", label: "Shared seats", icon: Armchair },
  { href: "/?tab=hire#search", label: "Full cab hire", icon: CarFront },
  { href: "/#routes", label: "Routes", icon: null },
  { href: "/#fleet", label: "Our fleet", icon: null },
  { href: "/#about", label: "About us", icon: null },
  { href: "/#faq", label: "Help", icon: null },
];

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}

export default function HeaderBar({ brand, supportPhone, user }: Props) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const tel = supportPhone.replace(/\s/g, "");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const mobileLink = "flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-ink hover:bg-slate-50";

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white transition-shadow duration-200 ${
        scrolled || open ? "border-slate-200 shadow-[0_6px_24px_rgb(15_23_42/0.08)]" : "border-slate-100"
      }`}
    >
      <div className="container-x flex h-[68px] items-center justify-between gap-4">
        <Logo brand={brand} />

        <nav className="hidden items-center gap-0.5 text-sm font-semibold text-slate-600 xl:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-1.5 rounded-lg px-3 py-2 whitespace-nowrap transition hover:bg-slate-100 hover:text-ink">
              {n.icon && <n.icon className="h-4 w-4 text-brand" aria-hidden />}
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 text-sm font-semibold xl:flex">
          {user ? (
            <>
              {user.isAdmin && (
                <Link href="/admin" className="btn bg-ink px-3 py-2 text-white hover:bg-slate-700">
                  <LayoutDashboard className="h-4 w-4" aria-hidden /> Admin
                </Link>
              )}
              <Link href="/my-bookings" className="btn-soft px-3 py-2">
                <Ticket className="h-4 w-4" aria-hidden /> My Trips
              </Link>
              <span className="ml-1 hidden items-center gap-1.5 whitespace-nowrap text-slate-500 2xl:flex">
                <UserRound className="h-4 w-4" aria-hidden /> Hi, {user.firstName}
              </span>
              <button onClick={logout} className="btn px-2.5 py-2 text-slate-500 hover:bg-slate-100 hover:text-ink" aria-label="Logout" title="Logout">
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : (
            <>
              <Link href="/login?next=/my-bookings" className="btn px-3 py-2 text-slate-600 hover:bg-slate-100">
                <Ticket className="h-4 w-4" aria-hidden /> My Trips
              </Link>
              <Link href="/login" className="btn-primary px-4 py-2">
                <UserRound className="h-4 w-4" aria-hidden /> Login / Sign up
              </Link>
            </>
          )}
        </div>

        <button
          className="grid h-10 w-10 place-items-center rounded-xl text-ink ring-1 ring-slate-200 hover:bg-slate-50 xl:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full z-40 h-[calc(100dvh-4rem)] overflow-y-auto border-t border-slate-200 bg-white xl:hidden">
          <div className="container-x space-y-1 py-4">
            {user && <p className="px-3 pb-2 text-sm text-slate-500">Hi, {user.firstName}</p>}
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={mobileLink}>
                {n.icon ? <n.icon className="h-5 w-5 text-brand" aria-hidden /> : <span className="w-5" />}
                {n.label}
              </Link>
            ))}
            <div className="my-3 border-t border-slate-100" />
            <Link href={user ? "/my-bookings" : "/login?next=/my-bookings"} onClick={() => setOpen(false)} className={mobileLink}>
              <Ticket className="h-5 w-5 text-brand" aria-hidden /> My Trips
            </Link>
            {user?.isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)} className={mobileLink}>
                <LayoutDashboard className="h-5 w-5 text-brand" aria-hidden /> Admin panel
              </Link>
            )}
            {supportPhone && (
              <a href={`tel:${tel}`} className={mobileLink}>
                <Phone className="h-5 w-5 text-brand" aria-hidden /> {supportPhone}
              </a>
            )}
            <div className="pt-3">
              {user ? (
                <button onClick={logout} className="btn-ghost w-full py-3">
                  <LogOut className="h-4 w-4" aria-hidden /> Logout
                </button>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)} className="btn-primary w-full py-3">
                  <UserRound className="h-4 w-4" aria-hidden /> Login / Sign up
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
