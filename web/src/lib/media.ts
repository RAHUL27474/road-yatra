/** Stock photos in /public/images (see public/images/CREDITS.md) and small display helpers. */

export const HERO_IMAGE = "/images/hero-highway.webp";
export const HILLS_IMAGE = "/images/hero-hills.webp";
export const ROADTRIP_IMAGE = "/images/why-roadtrip.webp";
export const EMPTY_ROAD_IMAGE = "/images/empty-road.webp";

/** Owner-supplied brand artwork (public/images/brand). */
export const BRAND = {
  /** The logo mark (also src/app/icon.svg, the favicon). */
  logoMark: "/images/brand/logo-mark.svg",
  emblem: "/images/brand/emblem-khatushyam.webp",
  bannerWide: "/images/brand/banner-wide.webp",
  poster: "/images/brand/poster-portrait.webp",
  bannerTemple: "/images/brand/banner-temple-hi.webp",
  bannerKhatushyam: "/images/brand/banner-khatushyam-hi.webp",
};

/** WhatsApp chat link for an Indian phone number such as "+91 99976 81790". */
export function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}

const VEHICLE_PHOTOS: Record<string, string> = {
  SEDAN: "/images/car-sedan.webp",
  HATCHBACK: "/images/fleet-altroz-photo.webp",
  ERTIGA: "/images/car-mpv.webp",
  SUV: "/images/car-suv.webp",
  INNOVA_CRYSTA: "/images/car-suv.webp",
  TEMPO_TRAVELLER: "/images/car-mpv.webp",
  BUS: "/images/car-mpv.webp",
  OTHER: "/images/car-mpv.webp",
};

/** Photos of the vehicle models we run (see CREDITS.md), matched by vehicle name. */
const FLEET_PHOTOS: [RegExp, string][] = [
  [/ertiga/i, "/images/fleet-ertiga-photo.webp"],
  [/dzire.*old/i, "/images/fleet-dzire-old-photo.webp"],
  [/dzire/i, "/images/fleet-dzire-new-photo.webp"],
  [/altroz/i, "/images/fleet-altroz-photo.webp"],
];

/** Photo for a vehicle (used when the office has not uploaded one): our fleet photo by name, else a stock photo by type. */
export function vehiclePhoto(type: string, name = "") {
  return FLEET_PHOTOS.find(([re]) => re.test(name))?.[1] ?? VEHICLE_PHOTOS[type] ?? VEHICLE_PHOTOS.OTHER;
}

const CITY_PHOTOS: Record<string, string> = {
  Delhi: "/images/dest-delhi.webp",
  Haldwani: "/images/dest-nainital.webp",
  Nainital: "/images/dest-nainital.webp",
  Dehradun: "/images/dest-dehradun.webp",
  Mussoorie: "/images/dest-mussoorie.webp",
  Haridwar: "/images/dest-haridwar.webp",
  Rishikesh: "/images/dest-rishikesh.webp",
  Auli: "/images/dest-auli.webp",
  Bareilly: "/images/dest-bareilly.webp",
  Moradabad: "/images/dest-bareilly.webp",
  Rudrapur: "/images/dest-rudrapur.webp",
  Pantnagar: "/images/dest-rudrapur.webp",
  Khatima: "/images/dest-khatima.webp",
};

export function cityPhoto(city: string) {
  return CITY_PHOTOS[city] ?? HILLS_IMAGE;
}

/** Small state caption shown under city names. */
const CITY_STATE: Record<string, string> = {
  Khatima: "Uttarakhand",
  Rudrapur: "Uttarakhand",
  Pantnagar: "Uttarakhand",
  Haldwani: "Uttarakhand",
  Nainital: "Uttarakhand",
  Dehradun: "Uttarakhand",
  Mussoorie: "Uttarakhand",
  Haridwar: "Uttarakhand",
  Rishikesh: "Uttarakhand",
  Auli: "Uttarakhand",
  Bareilly: "Uttar Pradesh",
  Moradabad: "Uttar Pradesh",
  Delhi: "Delhi NCR",
};

export function cityState(city: string) {
  return CITY_STATE[city] ?? "India";
}

/** Tomorrow 09:00 IST as a datetime-local value. */
export function tomorrowMorning() {
  const d = new Date(Date.now() + 24 * 3600_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return `${d}T09:00`;
}

/** Link for a route: seat search when shared trips run on it, otherwise a one-way full cab quote. */
export function routeHref(from: string, to: string, hasSeats: boolean, date: string) {
  if (hasSeats) return `/search?${new URLSearchParams({ from, to, date })}`;
  return `/hire?${new URLSearchParams({ type: "ONE_WAY", pickup: from, drop: to, start: tomorrowMorning() })}`;
}
