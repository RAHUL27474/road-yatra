import Link from "next/link";
import { BadgeCheck, Mail, MapPin, MessageCircle, Phone, Smartphone, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { routeHref, whatsappLink } from "@/lib/media";
import Logo from "./Logo";

export default async function Footer() {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Jai Shree Shyam Tour & Travels";
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "";
  const [{ business }, routes] = await Promise.all([
    getSettings(),
    db.route.findMany({
      where: { fromCity: "Khatima" },
      orderBy: { distanceKm: "asc" },
      select: { toCity: true, _count: { select: { trips: { where: { status: "SCHEDULED", departAt: { gt: new Date() } } } } } },
    }),
  ]);
  const seatRoutes = new Set(routes.filter((r) => r._count.trips > 0).map((r) => r.toCity));
  const email = business.email || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
  const ORDER = ["Delhi", "Haridwar", "Nainital", "Mussoorie", "Rishikesh", "Auli"];
  const rank = (c: string) => (ORDER.indexOf(c) + 1 || 99) - (seatRoutes.has(c) ? 0.5 : 0);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const quick = [
    ["/?tab=seats#search", "Book a shared seat"],
    ["/?tab=hire#search", "Hire a full cab"],
    ["/my-bookings", "My trips"],
    ["/yatra", "Pilgrimage trips"],
    ["/feedback", "Feedback"],
    ["/#faq", "Help & FAQ"],
    ["/login", "Login / Sign up"],
    ["/privacy", "Privacy policy"],
    ["/terms", "Terms & cancellation"],
  ];

  return (
    <footer className="relative mt-auto bg-brand-darker text-sm text-blue-100/70">
      <div className="saffron-gradient absolute inset-x-0 top-0 h-1" aria-hidden />
      <div className="container-x grid grid-cols-2 gap-x-6 gap-y-10 py-14 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="col-span-2 lg:col-span-1">
          <Logo brand={brand} light />
          <p className="deva mt-4 text-sm font-semibold text-gold">॥ जय श्री श्याम ॥ · खाटू श्याम जी की कृपा से</p>
          <p className="mt-2 max-w-xs leading-relaxed">
            Your Journey Our Priority. Daily shared taxi from Khatima to Delhi and Haridwar, one-way and round-trip cabs, and hill station trips. Safe · Comfortable · Reliable.
          </p>
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold tracking-wider text-blue-200/50 uppercase">Mobile app</p>
            <div className="inline-flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-slate-200">
              <Smartphone className="h-6 w-6 text-gold" aria-hidden />
              <div className="leading-tight">
                <p className="text-[11px] text-slate-400">Android &amp; iOS</p>
                <p className="font-semibold text-white">Coming soon</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-4 font-semibold text-white">Quick links</h3>
          <ul className="space-y-2.5">
            {quick.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="transition hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 font-semibold text-white">Routes from Khatima</h3>
          <ul className="space-y-2.5">
            {[...routes].sort((a, b) => rank(a.toCity) - rank(b.toCity)).slice(0, 8).map((r) => (
              <li key={r.toCity}>
                <Link
                  href={routeHref("Khatima", r.toCity, seatRoutes.has(r.toCity), today)}
                  className="transition hover:text-white"
                >
                  Khatima – {r.toCity}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 lg:col-span-1">
          <h3 className="mb-4 font-semibold text-white">Support</h3>
          <ul className="space-y-3">
            {phone && (
              <li>
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-start gap-2.5 transition hover:text-white">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
                  <span>
                    {phone}
                    <span className="block text-xs text-blue-200/50">Bookings · day &amp; night</span>
                  </span>
                </a>
              </li>
            )}
            {phone && (
              <li>
                <a href={whatsappLink(phone)} target="_blank" rel="noopener" className="flex items-start gap-2.5 transition hover:text-white">
                  <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
                  Chat on WhatsApp
                </a>
              </li>
            )}
            {email && (
              <li>
                <a href={`mailto:${email}`} className="flex items-start gap-2.5 transition hover:text-white">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
                  {email}
                </a>
              </li>
            )}
            {business.address && (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
                <span className="whitespace-pre-line">{business.address}</span>
              </li>
            )}
            <li className="flex items-start gap-2.5">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
              <span>Proprietor: Sanjeev Singh Kushwaha</span>
            </li>
            {business.gstin && (
              <li className="flex items-start gap-2.5">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
                <span>GSTIN: {business.gstin}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-blue-200/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {business.legalName || brand}. All rights reserved. ·{" "}
            <a href="/credits" className="underline-offset-2 hover:text-white hover:underline">Photo credits</a>
          </p>
          <p>5% GST is shown upfront before you pay. Toll and parking on full cab trips are listed separately.</p>
        </div>
      </div>
    </footer>
  );
}
