import type { Metadata, Viewport } from "next";
import { Noto_Sans_Devanagari, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PublicChrome from "@/components/PublicChrome";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Jai Shree Shyam Tour & Travels";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["500", "700"], variable: "--font-deva", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${brand} – Khatima to Delhi & Haridwar taxi, cab hire`, template: `%s | ${brand}` },
  description:
    "Your Journey Our Priority. Daily shared taxi Khatima to Delhi and Khatima to Haridwar, one-way and round-trip cabs, and hill station trips to Nainital, Mussoorie, Rishikesh and Auli. Service day and night.",
};

export const viewport: Viewport = { themeColor: "#0f2a75" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${deva.variable}`}>
      <body className="flex min-h-screen flex-col">
        <PublicChrome>
          <Header />
        </PublicChrome>
        <main className="flex-1">{children}</main>
        <PublicChrome>
          <Footer />
        </PublicChrome>
      </body>
    </html>
  );
}
