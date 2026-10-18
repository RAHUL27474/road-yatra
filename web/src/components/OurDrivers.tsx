import { ShieldCheck } from "lucide-react";
import { publicDrivers } from "@/lib/public-drivers";

/** Home page section: photo and name of every driver the office chose to show. Renders nothing if none. */
export default async function OurDrivers() {
  const drivers = await publicDrivers();
  if (!drivers.length) return null;
  return (
    <section className="section container-x">
      <div className="text-center">
        <p className="eyebrow">Our team</p>
        <h2 className="section-title mt-1">Meet our drivers</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">Licence-checked, experienced drivers who know the Khatima–Delhi and hill routes. You see your driver&apos;s name, photo and number on your ticket.</p>
      </div>
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {drivers.map((d) => (
          <li key={d.id} className="card flex flex-col items-center p-5 text-center">
            {d.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.photoUrl} alt={d.name} className="h-24 w-24 rounded-full object-cover ring-4 ring-brand-light" loading="lazy" />
            ) : (
              <span className="grid h-24 w-24 place-items-center rounded-full bg-brand text-3xl font-extrabold text-white ring-4 ring-brand-light">{d.name.trim()[0]}</span>
            )}
            <p className="mt-3 font-bold text-ink">{d.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-green-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Verified driver
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {[d.experienceYears ? `${d.experienceYears} yrs experience` : null, d.tripsDone ? `${d.tripsDone} trips` : null].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
