import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export default async function Header() {
  const user = await getCurrentUser();
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Road Yatra";
  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-extrabold text-brand">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-white">🚐</span>
          {brand}
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-3">
          <Link href="/?tab=seats" className="hidden rounded-lg px-3 py-2 hover:bg-slate-100 sm:block">Seats</Link>
          <Link href="/?tab=hire" className="hidden rounded-lg px-3 py-2 hover:bg-slate-100 sm:block">Hire a Vehicle</Link>
          {user ? (
            <>
              <Link href="/my-bookings" className="rounded-lg px-3 py-2 hover:bg-slate-100">My Trips</Link>
              {user.role === "ADMIN" && (
                <Link href="/admin" className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700">Admin</Link>
              )}
              <span className="hidden text-slate-500 md:inline">Hi, {user.name.split(" ")[0]}</span>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="btn-primary">Login / Sign up</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
