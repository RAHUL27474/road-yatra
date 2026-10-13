/** Stock photos in /public/images (see public/images/CREDITS.md) and small display helpers. */

export const HERO_IMAGE = "/images/hero-highway.jpg";
export const HILLS_IMAGE = "/images/hero-hills.jpg";
export const ROADTRIP_IMAGE = "/images/why-roadtrip.jpg";
export const EMPTY_ROAD_IMAGE = "/images/empty-road.jpg";

/** Owner-supplied brand artwork (public/images/brand). */
export const BRAND = {
  emblem: "/images/brand/emblem-khatushyam.jpg",
  bannerWide: "/images/brand/banner-wide.jpg",
  poster: "/images/brand/poster-portrait.jpg",
  bannerTemple: "/images/brand/banner-temple-hi.jpg",
  bannerKhatushyam: "/images/brand/banner-khatushyam-hi.jpg",
};

/** WhatsApp chat link for an Indian phone number such as "+91 99976 81790". */
export function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}

const VEHICLE_PHOTOS: Record<string, string> = {
  SEDAN: "/images/car-sedan.jpg",
  HATCHBACK: "/images/fleet-altroz-photo.jpg",
  ERTIGA: "/images/car-mpv.jpg",
  SUV: "/images/car-suv.jpg",
  INNOVA_CRYSTA: "/images/car-suv.jpg",
  TEMPO_TRAVELLER: "/images/car-mpv.jpg",
  BUS: "/images/car-mpv.jpg",
  OTHER: "/images/car-mpv.jpg",
};

/** Photos of the vehicle models we run (see CREDITS.md), matched by vehicle name. */
const FLEET_PHOTOS: [RegExp, string][] = [
  [/ertiga/i, "/images/fleet-ertiga-photo.jpg"],
  [/dzire.*old/i, "/images/fleet-dzire-old-photo.jpg"],
  [/dzire/i, "/images/fleet-dzire-new-photo.jpg"],
  [/altroz/i, "/images/fleet-altroz-photo.jpg"],
];

/** Photo for a vehicle (used when the office has not uploaded one): our fleet photo by name, else a stock photo by type. */
export function vehiclePhoto(type: string, name = "") {
  return FLEET_PHOTOS.find(([re]) => re.test(name))?.[1] ?? VEHICLE_PHOTOS[type] ?? VEHICLE_PHOTOS.OTHER;
}

const CITY_PHOTOS: Record<string, string> = {
  Delhi: "/images/dest-delhi.jpg",
  Haldwani: "/images/dest-nainital.jpg",
  Nainital: "/images/dest-nainital.jpg",
  Dehradun: "/images/dest-dehradun.jpg",
  Mussoorie: "/images/dest-mussoorie.jpg",
  Haridwar: "/images/dest-haridwar.jpg",
  Rishikesh: "/images/dest-rishikesh.jpg",
  Auli: "/images/dest-auli.jpg",
  Bareilly: "/images/dest-bareilly.jpg",
  Moradabad: "/images/dest-bareilly.jpg",
  Rudrapur: "/images/dest-rudrapur.jpg",
  Pantnagar: "/images/dest-rudrapur.jpg",
  Khatima: "/images/dest-khatima.jpg",
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
