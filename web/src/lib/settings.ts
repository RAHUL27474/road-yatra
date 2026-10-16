import { db } from "./db";

export type CancellationSlab = { minHoursBefore: number; refundPercent: number };

export type Settings = {
  business: { legalName: string; gstin: string; address: string; stateName: string; stateCode: string; sacCode: string; email: string };
  cancellationSlabs: CancellationSlab[]; // checked from the largest minHoursBefore down
  allowCash: boolean; // let customers choose "pay cash to driver"
  travelPolicy: string; // luggage / child / pet rules, shown before booking and on the ticket (one rule per line)
  returnDiscountPercent: number; // off the fare of the return leg when the customer already booked the onward trip
  freeChangeHours: number; // a customer may change date or pickup once, up to this many hours before departure (0 = off)
  advancePerSeat: number; // with Razorpay: pay this much online to hold a seat, rest in cash (0 = off)
};

export const DEFAULT_SETTINGS: Settings = {
  business: {
    legalName: process.env.NEXT_PUBLIC_BRAND_NAME || "Jai Shree Shyam Tour & Travels",
    gstin: "",
    address: "Khatima, Udham Singh Nagar, Uttarakhand",
    stateName: "Uttarakhand",
    stateCode: "05",
    sacCode: "9964",
    email: "",
  },
  cancellationSlabs: [
    { minHoursBefore: 24, refundPercent: 100 },
    { minHoursBefore: 2, refundPercent: 50 },
    { minHoursBefore: 0, refundPercent: 0 },
  ],
  allowCash: true,
  travelPolicy: [
    "One medium bag (up to 15 kg) per seat in the boot, plus one small handbag on your lap.",
    "Children aged 5 and above need their own seat. Children under 5 can travel on a parent's lap free.",
    "Pets are allowed only on full-cab bookings, not in shared seats.",
    "No smoking or alcohol in the vehicle.",
  ].join("\n"),
  returnDiscountPercent: 5,
  freeChangeHours: 2,
  advancePerSeat: 0,
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  return {
    business: { ...DEFAULT_SETTINGS.business, ...(stored.business ?? {}) },
    cancellationSlabs: stored.cancellationSlabs ?? DEFAULT_SETTINGS.cancellationSlabs,
    allowCash: stored.allowCash ?? DEFAULT_SETTINGS.allowCash,
    travelPolicy: stored.travelPolicy ?? DEFAULT_SETTINGS.travelPolicy,
    returnDiscountPercent: stored.returnDiscountPercent ?? DEFAULT_SETTINGS.returnDiscountPercent,
    freeChangeHours: stored.freeChangeHours ?? DEFAULT_SETTINGS.freeChangeHours,
    advancePerSeat: stored.advancePerSeat ?? DEFAULT_SETTINGS.advancePerSeat,
  };
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const json = JSON.stringify(value);
  await db.setting.upsert({ where: { key }, update: { value: json }, create: { key, value: json } });
}
