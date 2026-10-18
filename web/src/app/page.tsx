import OurDrivers from "@/components/OurDrivers";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CarFront,
  ChevronDown,
  CircleCheck,
  Clock,
  Globe,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  QrCode,
  Repeat,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Smile,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { db } from "@/lib/db";
import { fmtDuration, inr, VEHICLE_TYPES } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { HOLD_MINUTES } from "@/lib/booking";
import { cityPhoto, HERO_IMAGE, HILLS_IMAGE, ROADTRIP_IMAGE, routeHref, whatsappLink } from "@/lib/media";
import SearchBox from "@/components/SearchBox";
import VehicleImage from "@/components/VehicleImage";
import Amenities from "@/components/Amenities";
import { splitBrand } from "@/components/Logo";

export const dynamic = "force-dynamic";

const FEATURED = ["Delhi", "Haridwar"];
const HILL_STATIONS = ["Nainital", "Mussoorie", "Rishikesh", "Auli"];

function slabText(slabs: { minHoursBefore: number; refundPercent: number }[]) {
  const sorted = [...slabs].sort((a, b) => b.minHoursBefore - a.minHoursBefore);
  return sorted.map((s, i) => {
    const upper = sorted[i - 1]?.minHoursBefore;
    const window =
      i === 0 ? `${s.minHoursBefore} hours or more before departure` : s.minHoursBefore === 0 ? `less than ${upper} hours before departure` : `${s.minHoursBefore} to ${upper} hours before departure`;
    return `${window}: ${s.refundPercent === 0 ? "no refund" : `${s.refundPercent}% of the fare refunded`}`;
  });
}

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const now = new Date();
  const [routes, vehicles, fares, settings, stops] = await Promise.all([
    db.route.findMany({ orderBy: { distanceKm: "asc" } }),
    db.vehicle.findMany({ where: { active: true }, orderBy: [{ seats: "desc" }, { name: "asc" }] }),
    db.trip.groupBy({ by: ["routeId"], where: { status: "SCHEDULED", departAt: { gt: now } }, _min: { fare: true } }),
    getSettings(),
    db.stop.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Jai Shree Shyam Tour & Travels";
  const [brandMain] = splitBrand(brand);
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "";
  const tel = phone.replace(/\s/g, "");
  const cities = [...new Set(routes.flatMap((r) => [r.fromCity, r.toCity]))].sort();
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const seatFrom = new Map(fares.map((f) => [f.routeId, f._min.fare ?? 0]));
  const lowestSeat = fares.length ? Math.min(...fares.map((f) => f._min.fare ?? Infinity)) : null;
  const rentalRates = vehicles.filter((v) => v.allowRental).map((v) => v.ratePerKm);
  const cabFromPerKm = rentalRates.length ? Math.min(...rentalRates) : null;
  const fromKhatima = (city: string) => routes.find((r) => r.fromCity === "Khatima" && r.toCity === city);
  const featured = FEATURED.map(fromKhatima).filter((r) => !!r);
  const returns = [...FEATURED, ...HILL_STATIONS].map((city) => routes.find((r) => r.fromCity === city && r.toCity === "Khatima")).filter((r) => !!r);
  const hills = HILL_STATIONS.map(fromKhatima).filter((r) => !!r);
  const stopsBy = (city: string) => stops.filter((s) => s.city === city).map((s) => s.name);
  const luggageVehicles = vehicles.filter((v) => /luggage/i.test(v.amenities)).map((v) => v.name);

  const routeInfo = (r: (typeof routes)[number]) => {
    const from = seatFrom.get(r.id);
    const hasSeats = from != null && from > 0;
    return { hasSeats, from, href: routeHref(r.fromCity, r.toCity, hasSeats, today) };
  };

  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "What is the cancellation and refund policy?",
      a: (
        <>
          <p>You can cancel online from My Trips before the trip starts. The refund depends on how early you cancel:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {slabText(settings.cancellationSlabs).map((t) => (
              <li key={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</li>
            ))}
          </ul>
          <p className="mt-2">For full cab bookings, toll and parking charges are always refunded in full. Refunds for online payments reach your account in 5–7 working days.</p>
        </>
      ),
    },
    {
      q: "Can I pay in cash?",
      a: settings.allowCash ? (
        <p>
          Yes. Choose <b>Cash to driver</b> at checkout and your booking is confirmed immediately; you pay the driver when you board. You can also pay online with UPI, cards or net banking. Online
          bookings are held for {HOLD_MINUTES} minutes while you complete payment.
        </p>
      ) : (
        <p>Bookings are paid online with UPI, cards or net banking. Your seats or cab are held for {HOLD_MINUTES} minutes while you complete payment.</p>
      ),
    },
    {
      q: "Can I book in advance, and do you run at night?",
      a: (
        <p>
          Yes. Advance booking is available for shared seats and full cabs, and we provide service day and night. For a late-night or very early pickup, you can also call us
          {phone ? ` on ${phone}` : ""}.
        </p>
      ),
    },
    {
      q: "Do you go outside Uttarakhand?",
      a: (
        <p>
          Yes. Besides our daily Khatima–Delhi and Khatima–Haridwar service and hill station trips, we offer one-way and round-trip taxis for all-India travel. Search for a full cab, or call
          us to plan a longer trip.
        </p>
      ),
    },
    {
      q: "How much luggage can I carry?",
      a: (
        <p>
          Luggage space depends on the vehicle.{luggageVehicles.length ? ` The ${luggageVehicles.join(" and ")} is listed with extra luggage space.` : ""} If you are carrying more than usual
          travel bags, call us{phone ? ` on ${phone}` : ""} before booking, or hire a full cab so the boot is yours.
        </p>
      ),
    },
    {
      q: "Where do I board, and where will I be dropped?",
      a: (
        <>
          <p>When you book a shared seat you pick your pickup and drop point from the list.</p>
          {["Khatima", "Delhi", "Haridwar"].map(
            (c) =>
              stopsBy(c).length > 0 && (
                <p key={c} className="mt-2">
                  <b>{c}:</b> {stopsBy(c).join(", ")}
                </p>
              ),
          )}
          <p className="mt-2">For a full cab, the driver picks you up from the address you enter.</p>
        </>
      ),
    },
    {
      q: "Can my family track the vehicle?",
      a: (
        <p>
          Yes. Once the driver starts the trip, your booking page shows a <b>Track vehicle</b> link with the live location on a map and an approximate ETA. You can share the link with family. The tracking
          page also has SOS (112) and support call buttons.
        </p>
      ),
    },
  ];

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative isolate overflow-hidden bg-brand-darker">
        <Image src={HERO_IMAGE} alt="Hill highway in Uttarakhand" fill priority sizes="100vw" className="-z-10 object-cover object-[72%_center]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-darker/95 via-brand-darker/60 to-brand-darker/0" />
        <div className="absolute inset-0 -z-10 bg-brand-darker/40 sm:hidden" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-brand-darker/60 to-transparent" />
        <div className="container-x pt-10 pb-40 sm:pt-16 sm:pb-48 lg:pb-52">
          <p className="deva inline-flex items-center gap-2 text-base font-bold tracking-wide text-gold sm:text-lg">
            <Sparkles className="h-4 w-4" aria-hidden /> ॥ जय श्री श्याम ॥
          </p>
          <h1 className="mt-3 max-w-3xl text-[2rem] leading-[1.12] font-extrabold tracking-tight text-white sm:text-5xl">
            Khatima se Delhi – <span className="text-gold">Seat bhi book karein,</span> Puri Cab bhi.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-200 sm:text-lg">
            Daily shared taxi from Khatima to Delhi and Haridwar, one-way and round-trip cabs, and hill station trips to Nainital, Mussoorie, Rishikesh and Auli. Service day and night.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold text-white sm:text-sm">
            <span className="saffron-gradient rounded-full px-3 py-1 shadow-md">Your Journey Our Priority</span>
            {["Safe", "Comfortable", "Reliable"].map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-full bg-white/12 px-3 py-1 ring-1 ring-white/25 backdrop-blur">
                <CircleCheck className="h-3.5 w-3.5 text-gold" aria-hidden /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="search" className="relative z-20 container-x -mt-32 scroll-mt-28 sm:-mt-36">
        <SearchBox key={tab ?? "seats"} cities={cities} initialTab={tab === "hire" ? "hire" : "seats"} />
      </section>

      {/* ---------- Benefits strip ---------- */}
      <section className="container-x mt-16">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              [ShieldCheck, "Safe Travel"],
              [Clock, "On Time Service"],
              [UserCheck, "Professional Drivers"],
              [Wrench, "Well Maintained Vehicles"],
              [Globe, "All India Service"],
              [Smile, "Comfortable Ride"],
            ] as const
          ).map(([Icon, title]) => (
            <li key={title} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-slate-200/70 lg:flex-col lg:p-4 lg:text-center">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-gold">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-sm leading-tight font-bold text-ink">{title}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Routes ---------- */}
      {(featured.length > 0 || hills.length > 0) && (
        <section id="routes" className="section container-x scroll-mt-24">
          <p className="eyebrow">Daily service</p>
          <h2 className="section-title mt-1">Popular routes from Khatima</h2>
          <p className="section-sub">
            Daily departures to Delhi and Haridwar{lowestSeat ? `, with shared seats from ${inr(lowestSeat)} per person` : ""}. Hill station trips by full cab, one way or round trip.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {featured.map((r) => {
              const { hasSeats, from, href } = routeInfo(r);
              return (
                <Link key={r.id} href={href} className="group card card-hover relative isolate flex min-h-[300px] flex-col justify-end overflow-hidden text-white sm:min-h-[340px]">
                  <Image src={cityPhoto(r.toCity)} alt={r.toCity} fill sizes="(min-width: 768px) 560px, 100vw" className="-z-10 object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-darker/95 via-brand-darker/35 to-transparent" />
                  <span className="saffron-gradient badge absolute top-4 left-4 px-3 py-1 text-white shadow">{hasSeats ? "Daily shared service" : "Daily service"}</span>
                  <div className="p-6">
                    <p className="text-sm font-semibold text-gold">Khatima to</p>
                    <p className="text-3xl font-extrabold sm:text-4xl">{r.toCity}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-sm text-slate-200">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" aria-hidden /> {r.distanceKm} km
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" aria-hidden /> {fmtDuration(r.durationMins)}
                        </span>
                      </div>
                      <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand shadow">
                        {hasSeats ? `Seat from ${inr(from!)}` : cabFromPerKm != null ? `Cab from ${inr(cabFromPerKm)}/km` : "View options"}
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {returns.length > 0 && (
            <>
            <h3 className="mt-10 text-lg font-bold text-ink">Coming back to Khatima</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {returns.map((r) => {
                const { hasSeats, from, href } = routeInfo(r);
                return (
                  <Link key={r.id} href={href} className="card card-hover flex items-center gap-4 p-4">
                    <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl">
                      <Image src={cityPhoto(r.fromCity)} alt={r.fromCity} fill sizes="96px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-accent">{hasSeats ? "Return journey · Daily shared" : "Return journey · Full cab"}</span>
                      <span className="block text-lg font-extrabold text-ink">
                        {r.fromCity} → Khatima
                      </span>
                      <span className="text-sm text-slate-500">
                        {r.distanceKm} km · {fmtDuration(r.durationMins)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-brand">
                      {hasSeats ? `from ${inr(from!)}` : "Book cab"} <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </Link>
                );
              })}
            </div>
            </>
          )}

          {hills.length > 0 && (
            <>
              <h3 className="mt-12 flex items-center gap-2 text-lg font-bold text-ink">
                <span className="h-5 w-1.5 rounded-full bg-gold" /> Hill stations & pilgrimages
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {hills.map((r) => {
                  const { href } = routeInfo(r);
                  return (
                    <Link key={r.id} href={href} className="group card card-hover overflow-hidden">
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <Image src={cityPhoto(r.toCity)} alt={r.toCity} fill sizes="(min-width: 1024px) 270px, 50vw" className="object-cover transition duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                        <p className="absolute bottom-3 left-3 text-lg font-extrabold text-white">{r.toCity}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 p-3 text-xs text-slate-500">
                        <span>
                          {r.distanceKm} km · {fmtDuration(r.durationMins)}
                        </span>
                        {cabFromPerKm != null && <b className="text-ink">from {inr(cabFromPerKm)}/km</b>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------- Services ---------- */}
      <section className="bg-brand-darker py-14 text-white sm:py-16">
        <div className="container-x">
          <p className="text-xs font-bold tracking-[0.14em] text-gold uppercase">What we offer</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Our services</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                [Users, "Daily shared taxi", "Fixed daily departures between Khatima and Delhi, and Khatima and Haridwar. Book just the seats you need."],
                [RouteIcon, "One-way taxi", "A full cab with driver to your destination, priced by distance with GST shown upfront."],
                [Repeat, "Round-trip taxi", "Keep the cab for your return journey, for family visits, pilgrimages and hill station trips."],
                [CalendarCheck, "Advance booking", "Book days ahead online, or call us to plan your trip."],
                [Moon, "Day & night service", "Early-morning and late-night pickups. We are reachable 24×7."],
                [Globe, "All-India service", "Need to go beyond our daily routes? We arrange one-way and round-trip cabs across India."],
              ] as const
            ).map(([Icon, title, text]) => (
              <div key={title} className="flex gap-4 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
                <span className="saffron-gradient grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-lg shadow-black/20">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-blue-100/80">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Fleet ---------- */}
      {vehicles.length > 0 && (
        <section id="fleet" className="section container-x scroll-mt-24">
          <p className="eyebrow">Our own vehicles</p>
          <h2 className="section-title mt-1">Our fleet</h2>
          <p className="section-sub">Clean white cars, well maintained and driven by our own professional drivers.</p>
          <div className={`mt-8 grid gap-5 sm:grid-cols-2 ${vehicles.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {vehicles.map((v) => (
              <div key={v.id} className="card card-hover flex flex-col overflow-hidden">
                <VehicleImage vehicle={v} className="aspect-[16/9]" sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-ink">{v.name}</h3>
                      <p className="text-xs text-slate-500">{VEHICLE_TYPES[v.type] ?? v.type}</p>
                    </div>
                    <span className="chip shrink-0">
                      <Users className="h-3.5 w-3.5 text-brand" aria-hidden /> {v.seats}+1
                    </span>
                  </div>
                  <div className="mt-3">
                    <Amenities items={v.amenities.split(",").map((a) => a.trim()).filter(Boolean)} />
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="flex flex-wrap gap-1">
                      {v.allowSeatBooking && <span className="badge bg-accent-light text-accent">Shared</span>}
                      {v.allowRental && <span className="badge bg-brand-light text-brand">Full cab</span>}
                    </div>
                    {v.allowRental && (
                      <p className="text-xs whitespace-nowrap text-slate-500">
                        from <b className="text-base text-ink">{inr(v.ratePerKm)}</b>/km
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- How it works ---------- */}
      <section className="bg-white py-14 sm:py-20">
        <div className="container-x">
          <div className="text-center">
            <p className="eyebrow">Simple booking</p>
            <h2 className="section-title mt-1">How it works</h2>
          </div>
          <ol className="relative mt-10 grid gap-5 md:grid-cols-3">
            <div className="absolute top-9 right-[16%] left-[16%] hidden border-t-2 border-dashed border-slate-300 md:block" aria-hidden />
            {(
              [
                [Search, "Search your trip", "Pick your cities and date. Choose a shared seat on a daily departure, or a full cab at your own time."],
                [Wallet, "Choose & pay", `Select your seats and pickup point, or your car. Pay online by UPI or card${settings.allowCash ? ", or cash to the driver" : ""}.`],
                [QrCode, "Board & track", "Show the QR code or OTP to the driver. Track the vehicle live and share the trip with family."],
              ] as const
            ).map(([Icon, title, text], i) => (
              <li key={title} className="relative rounded-2xl bg-canvas p-6 text-center ring-1 ring-slate-200/70">
                <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30">
                  <Icon className="h-6 w-6" aria-hidden />
                  <span className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-gold text-xs font-extrabold text-brand-darker ring-2 ring-white">{i + 1}</span>
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <OurDrivers />

      {/* ---------- Why us ---------- */}
      <section className="section container-x">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-[var(--shadow-lift)]">
              <Image src={ROADTRIP_IMAGE} alt="View of the road from the driver's seat" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
            </div>
            <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-lift)] ring-1 ring-slate-200/70 sm:left-8">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-green-100 text-green-700">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">Own cars, own drivers</p>
                <p className="text-xs text-slate-500">No third-party operators</p>
              </div>
            </div>
          </div>
          <div>
            <p className="eyebrow">Why choose us</p>
            <h2 className="section-title mt-1">Safe, comfortable and reliable – every trip</h2>
            <ul className="mt-6 space-y-4">
              {[
                ["Our own vehicles and drivers", "Every trip runs in our own well-maintained white car with a professional driver we know."],
                ["Seat or whole cab, your choice", "Book just the seats you need on a daily departure, or the full car for family and outstation trips."],
                ["Fixed pickup and drop points", "Board at a listed point in Khatima and get down at a listed stop at your destination."],
                ["Fares you can see upfront", "Fare and 5% GST are shown before you pay, and a GST invoice is available for paid bookings."],
                ["Live tracking and SOS", "Share a live tracking link with family. The tracking page has SOS (112) and support buttons."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden />
                  <div>
                    <p className="font-semibold text-ink">{t}</p>
                    <p className="text-sm text-slate-500">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- About & banners ---------- */}
      <section id="about" className="scroll-mt-24 bg-white py-14 sm:py-20">
        <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:items-center">
          <div>
            <p className="deva text-lg font-bold text-accent">खाटू श्याम जी की कृपा से</p>
            <h2 className="section-title mt-2">About {brand}</h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              {brandMain} is a travel service from Khatima, Udham Singh Nagar, led by proprietor <b className="text-ink">Sanjeev Singh Kushwaha</b>. We run daily shared taxis to Delhi and
              Haridwar, one-way and round-trip cabs, and trips to Nainital, Mussoorie, Rishikesh, Auli and other destinations, with service day and night.
            </p>
            <p className="deva mt-3 text-slate-500">जय श्री श्याम टूर्स एंड ट्रैवल्स</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {phone && (
                <a href={`tel:${tel}`} className="btn-accent">
                  <Phone className="h-4 w-4" aria-hidden /> Call {phone}
                </a>
              )}
              {phone && (
                <a href={whatsappLink(phone)} target="_blank" rel="noopener" className="btn bg-[#1faa53] text-white hover:bg-[#178a43]">
                  <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
                </a>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {(
              [
                ["Haridwar", "Daily from Khatima", "col-span-2 aspect-[16/8]"],
                ["Delhi", "Daily from Khatima", "aspect-[4/3]"],
                ["Nainital", "Hill station trips", "aspect-[4/3]"],
              ] as const
            ).map(([city, caption, cls]) => (
              <div key={city} className={`group relative overflow-hidden rounded-2xl ring-1 ring-slate-200 ${cls}`}>
                <Image src={cityPhoto(city)} alt={city} fill sizes="(min-width: 1024px) 620px, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-3 left-4 text-white">
                  <p className="text-lg font-extrabold drop-shadow">{city}</p>
                  <p className="text-xs font-medium text-white/85">{caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="section container-x scroll-mt-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <p className="eyebrow">Help centre</p>
            <h2 className="section-title mt-1">Frequently asked questions</h2>
            <p className="section-sub">Can&apos;t find your answer? We are available day and night.</p>
            {phone && (
              <a href={`tel:${tel}`} className="btn-primary mt-6">
                <Phone className="h-4 w-4" aria-hidden /> Call {phone}
              </a>
            )}
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <details key={f.q} className="group card overflow-hidden" open={i === 0}>
                <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 font-semibold text-ink transition hover:bg-slate-50">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden />
                </summary>
                <div className="px-5 pb-5 text-sm leading-relaxed text-slate-600">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="container-x pb-16">
        <div className="relative isolate overflow-hidden rounded-3xl bg-brand-darker px-6 py-12 sm:px-12">
          <Image src={HILLS_IMAGE} alt="" fill sizes="(min-width: 1152px) 1152px, 100vw" className="-z-10 object-cover opacity-70" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-darker via-brand-darker/80 to-brand-darker/10" />
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="deva font-bold text-gold">॥ जय श्री श्याम ॥</p>
              <h2 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">Going to Delhi, Haridwar or the hills?</h2>
              <p className="mt-2 max-w-xl text-blue-100">Book a seat on the next daily departure, or hire the whole cab for your family.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/search?${new URLSearchParams({ from: "Khatima", to: "Delhi", date: today })}`} className="btn-accent btn-lg">
                <CalendarCheck className="h-5 w-5" aria-hidden /> Book a seat
              </Link>
              <Link href="/?tab=hire#search" className="btn btn-lg bg-white text-brand hover:bg-blue-50">
                <CarFront className="h-5 w-5" aria-hidden /> Hire a full cab
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
