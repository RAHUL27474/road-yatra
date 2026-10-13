"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  CarFront,
  ChartColumn,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  PhoneCall,
  Route,
  Settings,
  Ticket,
  UserRound,
  type LucideIcon,
} from "lucide-react";

const NAV: [string, LucideIcon, string][] = [
  ["/admin", LayoutDashboard, "Dashboard"],
  ["/admin/bookings", Ticket, "Bookings"],
  ["/admin/bookings/new", PhoneCall, "New phone booking"],
  ["/admin/trips", CalendarClock, "Trips & schedule"],
  ["/admin/vehicles", CarFront, "Vehicles"],
  ["/admin/drivers", UserRound, "Drivers"],
  ["/admin/routes", Route, "Routes & fares"],
  ["/admin/stops", MapPin, "Pickup points"],
  ["/admin/reports", ChartColumn, "Reports"],
  ["/admin/messages", MessageSquare, "SMS / WhatsApp log"],
  ["/admin/settings", Settings, "Settings"],
];

export default function AdminNav() {
  const path = usePathname();
  // Longest matching prefix wins, so /admin/bookings/new doesn't also highlight /admin/bookings.
  const active = NAV.map(([href]) => href)
    .filter((href) => path === href || (href !== "/admin" && path.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="card flex gap-1 overflow-x-auto p-2 md:sticky md:top-20 md:flex-col" aria-label="Admin">
      <p className="hidden px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase md:block">Office</p>
      {NAV.map(([href, Icon, label]) => {
        const on = href === active;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              on ? "bg-brand text-white shadow-sm shadow-brand/30" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
            }`}
          >
            <Icon className={`h-4 w-4 ${on ? "" : "text-slate-400"}`} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
