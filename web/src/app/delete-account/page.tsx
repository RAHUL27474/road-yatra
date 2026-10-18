import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { whatsappLink } from "@/lib/media";

export const metadata = {
  title: "Delete your account",
  description: "How to delete your Jai Shree Shyam Tour & Travels account (customer app and JSS Travels Driver app) and what happens to your data.",
};

/** Account deletion page (Google Play requires a web link as well as the in-app option). */
export default async function DeleteAccountPage() {
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "";
  const { business } = await getSettings();
  const email = business.email || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
  const msg = "Namaste, please delete my account.\nRegistered mobile number: \nName: ";

  return (
    <div className="container-x max-w-3xl space-y-6 py-10">
      <div>
        <h1 className="page-title">Delete your account</h1>
        <p className="mt-1 text-sm text-slate-500">For the Jai Shree Shyam Travels customer app, the website and the JSS Travels Driver app.</p>
      </div>

      <section className="card space-y-2 p-5 text-sm text-slate-700">
        <h2 className="font-bold text-ink">Customers — delete it yourself in the app</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open the Jai Shree Shyam Travels app and log in.</li>
          <li>Go to <b>Account</b> → <b>Delete account</b> and confirm.</li>
        </ol>
        <p>If you have an upcoming booking, cancel it (or finish the trip) first.</p>
      </section>

      <section className="card space-y-2 p-5 text-sm text-slate-700">
        <h2 className="font-bold text-ink">Drivers, or if you can&apos;t use the app — ask us</h2>
        <p>Send us your registered mobile number. We delete the account within 7 days and confirm on WhatsApp.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {phone && (
            <a href={`${whatsappLink(phone)}?text=${encodeURIComponent(msg)}`} className="btn-primary px-4 py-2">
              Request on WhatsApp
            </a>
          )}
          {email && (
            <a href={`mailto:${email}?subject=${encodeURIComponent("Delete my account")}&body=${encodeURIComponent(msg)}`} className="btn-ghost px-4 py-2">
              Request by email
            </a>
          )}
          {phone && (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn-ghost px-4 py-2">
              Call {phone}
            </a>
          )}
        </div>
      </section>

      <section className="card space-y-2 p-5 text-sm text-slate-700">
        <h2 className="font-bold text-ink">What is deleted and what is kept</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Deleted:</b> your name, mobile number, email, password, saved travellers and feedback contact details. For drivers also the licence and Aadhaar photos and profile photo.</li>
          <li><b>Kept, without your name or number:</b> past bookings and invoices (amounts, dates, invoice numbers), because Indian tax law requires us to keep business records.</li>
          <li>Location history is not stored — only a vehicle&apos;s latest position during a trip.</li>
        </ul>
        <p>
          More in our <Link href="/privacy" className="font-semibold text-brand">privacy policy</Link>.
        </p>
      </section>
    </div>
  );
}
