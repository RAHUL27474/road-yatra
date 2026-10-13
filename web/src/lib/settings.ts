import { db } from "./db";

export type CancellationSlab = { minHoursBefore: number; refundPercent: number };

export type Settings = {
  business: { legalName: string; gstin: string; address: string; stateName: string; stateCode: string; sacCode: string; email: string };
  cancellationSlabs: CancellationSlab[]; // checked from the largest minHoursBefore down
  allowCash: boolean; // let customers choose "pay cash to driver"
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
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  return {
    business: { ...DEFAULT_SETTINGS.business, ...(stored.business ?? {}) },
    cancellationSlabs: stored.cancellationSlabs ?? DEFAULT_SETTINGS.cancellationSlabs,
    allowCash: stored.allowCash ?? DEFAULT_SETTINGS.allowCash,
  };
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const json = JSON.stringify(value);
  await db.setting.upsert({ where: { key }, update: { value: json }, create: { key, value: json } });
}
