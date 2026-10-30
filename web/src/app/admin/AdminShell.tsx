"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  CarFront,
  ChartColumn,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  PhoneCall,
  Plus,
  Route,
  Settings,
  Ticket,
  UserRound,
  X,
  type LucideIcon,
  Map as MapIcon,
  Star,
} from "lucide-react";
import { LogoMark, splitBrand } from "@/components/Logo";

type Item = [href: string, icon: LucideIcon, label: string];

const GROUPS: [string, Item[]][] = [
  [
    "Overview",
    [
      ["/admin", LayoutDashboard, "Dashboard"],
      ["/admin/reports", ChartColumn, "Reports"],
    ],
  ],
  [
    "Bookings",
    [
      ["/admin/bookings", Ticket, "All bookings"],
      ["/admin/bookings/new", PhoneCall, "New phone booking"],
    ],
  ],
  [
    "Operations",
    [
      ["/admin/trips", CalendarClock, "Trips & schedule"],
      ["/admin/fleet", MapIcon, "Fleet on routes"],
      ["/admin/drivers", UserRound, "Drivers"],
      ["/admin/vehicles", CarFront, "Vehicles"],
    ],
  ],
  [
    "Customers",
    [
      ["/admin/feedback", Star, "Feedback"],
      ["/admin/messages", MessageSquare, "WhatsApp log"],
    ],
  ],
  [
    "Setup",
    [
      ["/admin/routes", Route, "Routes & fares"],
      ["/admin/stops", MapPin, "Pickup points"],
      ["/admin/settings", Settings, "Settings"],
    ],
  ],
];

const ALL = GROUPS.flatMap(([, items]) => items);

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}

type Props = { brand: string; userName: string; today: string; children: React.ReactNode };

/** The office portal's frame: navy sidebar (a drawer on phones), a slim top bar, and the page. */
export default function AdminShell({ brand, userName, today, children }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [main, caption] = splitBrand(brand);

  // Longest matching prefix wins, so /admin/bookings/new doesn't also highlight /admin/bookings.
  const active = ALL.map(([href]) => href)
    .filter((href) => path === href || (href !== "/admin" && path.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];
  const title = ALL.find(([href]) => href === active)?.[2] ?? "Office";

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-darker text-blue-100">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        <LogoMark className="h-12 w-12" />
        <div className="min-w-0 leading-none">
          <p className="truncate text-[15px] font-extrabold tracking-tight text-white">{main}</p>
          <p className="mt-1 text-[10px] font-bold tracking-[0.18em] text-accent uppercase">{caption ? "Office portal" : "Office"}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-lg p-1.5 text-blue-200 hover:bg-white/10 lg:hidden" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Office">
        {GROUPS.map(([group, items]) => (
          <div key={group} className="mb-5 last:mb-0">
            <p className="px-3 pb-1.5 text-[10.5px] font-bold tracking-[0.14em] text-blue-300/80 uppercase">{group}</p>
            {items.map(([href, Icon, label]) => {
              const on = href === active;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition ${
                    on ? "bg-white/[0.12] text-white" : "text-blue-100/75 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {on && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent" aria-hidden />}
                  <Icon className={`h-[17px] w-[17px] ${on ? "text-accent" : ""}`} aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-white">{userName.charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{userName}</p>
            <p className="text-xs text-blue-200/70">Administrator</p>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Link href="/" className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Website
          </Link>
          <button type="button" onClick={logout} className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Log out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Phone/tablet drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} aria-label="Close menu" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          {/* Pages carry their own heading, so on desktop the bar shows the date; on phones, where the menu is hidden, the page name. */}
          <p className="min-w-0 truncate text-[15px] font-bold text-ink lg:hidden">{title}</p>
          <p className="hidden text-sm font-medium text-slate-500 lg:block">{today}</p>
          <Link href="/admin/bookings/new" className="btn-accent ml-auto px-3 py-2 text-[13px]">
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">New phone booking</span>
            <span className="sm:hidden">Booking</span>
          </Link>
        </header>
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
