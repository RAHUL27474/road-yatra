import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { whatsappLink } from "@/lib/media";
import { routeSlug } from "@/lib/route-pages";

export const metadata = {
  title: "Pilgrimage trips — Khatu Shyam ji, Haridwar, Kainchi Dham",
  description: "Full cab and shared taxi from Khatima for Khatu Shyam ji, Haridwar, Kainchi Dham, Purnagiri and Vrindavan. Family trips, Ekadashi and mela dates.",
};

type Yatra = { name: string; city: string; place: string; text: string };

const YATRAS: Yatra[] = [
  { name: "Khatu Shyam ji", city: "Khatu", place: "Khatu, Sikar (Rajasthan)", text: "Ekadashi darshan and the Phalgun mela. Round trips with a night halt, for families and groups." },
  { name: "Haridwar", city: "Haridwar", place: "Har Ki Pauri", text: "Daily shared taxi, Ganga aarti, and special trips on snan and Kanwar dates." },
  { name: "Kainchi Dham", city: "Nainital", place: "Neem Karoli Baba ashram, near Nainital", text: "Day trips from Khatima, early start to beat the hill traffic." },
  { name: "Maa Purnagiri", city: "Tanakpur", place: "Tanakpur, Champawat", text: "Short trips, extra cabs during Navratri and the Purnagiri mela." },
  { name: "Vrindavan & Mathura", city: "Vrindavan", place: "Banke Bihari ji, Prem Mandir", text: "Weekend family trips, one way or round trip." },
];

/** Pilgrimage page: links to the route page when we run that route, otherwise a ready WhatsApp enquiry. */
export default async function YatraPage() {
  const routes = await db.route.findMany({ where: { fromCity: "Khatima" }, select: { fromCity: true, toCity: true } });
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "";
  return (
    <div className="container-x max-w-4xl space-y-6 py-10">
      <div>
        <p className="deva text-sm font-semibold text-accent">॥ जय श्री श्याम ॥</p>
        <h1 className="page-title">Pilgrimage trips</h1>
        <p className="mt-1 text-sm text-slate-600">Comfortable cabs with experienced drivers for darshan, snan and family yatras — from Khatima and nearby towns.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {YATRAS.map((y) => {
          const route = routes.find((r) => r.toCity === y.city);
          const msg = `Namaste, I want a cab for ${y.name} (${y.place}).\nFrom: Khatima\nDate: \nPeople: \nOne way / round trip: `;
          return (
            <section key={y.name} className="card flex flex-col p-5">
              <h2 className="text-lg font-bold">{y.name}</h2>
              <p className="text-xs text-slate-500">{y.place}</p>
              <p className="mt-2 flex-1 text-sm text-slate-700">{y.text}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {route && (
                  <Link href={`/taxi/${routeSlug(route.fromCity, route.toCity)}`} className="btn-primary px-3 py-1.5 text-sm">
                    Fares &amp; dates
                  </Link>
                )}
                {phone && (
                  <a href={`${whatsappLink(phone)}?text=${encodeURIComponent(msg)}`} className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm">
                    <MessageCircle className="h-4 w-4 text-green-600" aria-hidden /> Get a quote on WhatsApp
                  </a>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
