import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Road Yatra";

export const metadata: Metadata = {
  title: { default: `${brand} – Book seats & hire cabs`, template: `%s | ${brand}` },
  description: "Book bus and tempo traveller seats, or hire a cab, SUV or traveller for outstation, local and airport trips.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="mt-12 bg-slate-900 py-8 text-sm text-slate-400">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:flex-row sm:justify-between">
            <p>© {new Date().getFullYear()} {brand}. All rights reserved.</p>
            <p>Need help? Call {process.env.NEXT_PUBLIC_SUPPORT_PHONE}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
