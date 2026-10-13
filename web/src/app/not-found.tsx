import Image from "next/image";
import Link from "next/link";
import { Compass, House, Ticket } from "lucide-react";
import { EMPTY_ROAD_IMAGE } from "@/lib/media";

export default function NotFound() {
  return (
    <div className="container-x py-12 sm:py-20">
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-lift)] ring-1 ring-slate-200/70 md:grid-cols-2">
        <div className="relative aspect-[16/10] md:aspect-auto">
          <Image src={EMPTY_ROAD_IMAGE} alt="An empty road" fill sizes="(min-width: 768px) 450px, 100vw" className="object-cover" />
        </div>
        <div className="p-8 sm:p-12">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-light text-accent">
            <Compass className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-5 text-sm font-bold tracking-wider text-accent uppercase">Error 404</p>
          <h1 className="mt-1 text-3xl font-extrabold text-ink">Looks like a wrong turn</h1>
          <p className="mt-2 text-slate-500">This page does not exist, or the link has expired.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="btn-primary">
              <House className="h-4 w-4" aria-hidden /> Go home
            </Link>
            <Link href="/my-bookings" className="btn-ghost">
              <Ticket className="h-4 w-4" aria-hidden /> My trips
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
