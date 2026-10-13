import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "📊", "Dashboard"],
  ["/admin/bookings", "🎫", "Bookings"],
  ["/admin/bookings/new", "☎️", "New phone booking"],
  ["/admin/trips", "🗓️", "Trips & schedule"],
  ["/admin/vehicles", "🚐", "Vehicles"],
  ["/admin/drivers", "🧑‍✈️", "Drivers"],
  ["/admin/routes", "🛣️", "Routes & fares"],
  ["/admin/stops", "📍", "Pickup points"],
  ["/admin/reports", "📈", "Reports"],
  ["/admin/messages", "💬", "SMS / WhatsApp log"],
  ["/admin/settings", "⚙️", "Settings"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <nav className="card flex gap-1 overflow-x-auto p-2 md:sticky md:top-20 md:flex-col">
          {NAV.map(([href, icon, label]) => (
            <Link key={href} href={href} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100">
              <span>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
