import { getSettings } from "@/lib/settings";

export const metadata = { title: "Terms & cancellation" };

/** Booking terms. The cancellation table comes from Admin → Settings, so it always matches what the app charges. */
export default async function TermsPage() {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Jai Shree Shyam Tour & Travels";
  const { cancellationSlabs } = await getSettings();

  const terms = [
    "Shared-taxi seats are sold per seat on scheduled trips. Reach your pickup point at least 10 minutes before departure and show your QR ticket or boarding OTP to the driver.",
    "If you do not board by the time the trip leaves, the booking is marked as a no-show and is not refunded.",
    "Cash bookings are paid to the driver when you board (shared seat) or as agreed for a full cab. A GST invoice is issued once payment is received.",
    "Full-cab fares include the kilometres shown when you book; extra kilometres, tolls, parking and state taxes are charged as shown or as actually paid.",
    "Departure times can change because of weather, roads or safety. If we cancel a trip, you get a full refund.",
    "Please treat drivers and fellow passengers with respect. Drivers can refuse travel to anyone who is drunk, abusive or carrying unsafe items.",
  ];

  return (
    <div className="container-x max-w-3xl py-10">
      <h1 className="page-title mb-2">Terms &amp; cancellation</h1>
      <p className="mb-6 text-sm text-slate-500">For bookings with {brand} on the website and the app.</p>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 font-bold">Cancellation by you</h2>
        <table className="table">
          <thead>
            <tr>
              <th>When you cancel</th>
              <th>Refund</th>
            </tr>
          </thead>
          <tbody>
            {cancellationSlabs.map((s) => (
              <tr key={s.minHoursBefore}>
                <td>{s.minHoursBefore > 0 ? `${s.minHoursBefore}+ hours before departure` : "Less than that / after departure"}</td>
                <td>{s.refundPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-500">Online payments are refunded to the original payment method. Cash bookings that were not yet paid simply lapse.</p>
      </section>

      <section className="card p-5">
        <h2 className="mb-2 font-bold">Booking terms</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
          {terms.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
