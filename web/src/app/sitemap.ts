import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { routeSlug } from "@/lib/route-pages";

export const dynamic = "force-dynamic";

/** /sitemap.xml: home, every route page and the information pages, so Google finds "Khatima to Delhi taxi". */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL || "https://jaishreeshyamtravels.com").replace(/\/+$/, "");
  const routes = await db.route.findMany({ select: { fromCity: true, toCity: true } });
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/yatra`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...routes.map((r) => ({ url: `${base}/taxi/${routeSlug(r.fromCity, r.toCity)}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.9 })),
    { url: `${base}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
