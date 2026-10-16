import { getSettings } from "@/lib/settings";

export const metadata = { title: "Privacy policy" };

/** Plain-language privacy policy for the website, customer app and driver app. Linked from the apps (Google Play requires one). */
export default async function PrivacyPage() {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Jai Shree Shyam Tour & Travels";
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "";
  const { business } = await getSettings();
  const email = business.email || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
  const contact = [phone, email].filter(Boolean).join(" · ");

  const sections: [string, string[]][] = [
    [
      "What we collect",
      [
        "Your name, mobile number and (if you give it) email, to create your account and send booking messages.",
        "Booking details: journey, seats, pickup and drop points, passenger name and phone, amounts paid and refunds.",
        "Drivers: licence details and photos, Aadhaar photo (last 4 digits stored as text), profile photo, address and emergency contact, sent with the driver application.",
        "Drivers' location, only between “Start trip” and “End trip”, including while the driver app is in the background, so passengers and the office can track the vehicle.",
      ],
    ],
    [
      "How we use it",
      [
        "To confirm bookings, assign drivers and vehicles, run the trip and issue GST invoices.",
        "To send booking, driver and trip updates by SMS, WhatsApp, email or app notification.",
        "To show passengers the live position of their vehicle and the driver's name and number for their trip.",
        "For safety: an SOS from the driver app sends the driver's location to our office and their emergency contact.",
      ],
    ],
    [
      "Who we share it with",
      [
        "Your driver sees your name, phone, seats and pickup/drop point for your trip; you see the driver's name, number and vehicle number.",
        "Service providers who send SMS/WhatsApp/email or process payments for us, only for that purpose.",
        "Authorities when the law requires it. We do not sell your data.",
      ],
    ],
    [
      "How long we keep it",
      [
        "Account details: until you delete your account.",
        "Bookings and invoices: as long as Indian tax law requires us to keep business records, even after the account is deleted.",
        "Vehicle location: only the latest position of each vehicle is kept.",
      ],
    ],
    [
      "Your choices",
      [
        "Edit your name and email in the app (Account → Edit profile).",
        "Delete your account in the app (Account → Delete account), or ask us to do it.",
        "Turn off notifications or location permission in your phone settings at any time (drivers need location during trips).",
      ],
    ],
  ];

  return (
    <div className="container-x max-w-3xl py-10">
      <h1 className="page-title mb-2">Privacy policy</h1>
      <p className="mb-6 text-sm text-slate-500">
        {business.legalName || brand}. This policy covers our website, the customer app and the JSS Travels Driver app.
      </p>
      <div className="space-y-6">
        {sections.map(([title, items]) => (
          <section key={title} className="card p-5">
            <h2 className="mb-2 font-bold">{title}</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
              {items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ))}
        <section className="card p-5 text-sm text-slate-700">
          <h2 className="mb-2 font-bold">Contact</h2>
          <p>Questions or requests about your data: {contact || "please contact our office"}.</p>
          {business.address && <p className="mt-1">{business.address}</p>}
        </section>
      </div>
    </div>
  );
}
