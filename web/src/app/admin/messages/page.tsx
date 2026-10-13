import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

const STATUS: Record<string, string> = {
  SENT: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  LOGGED: "bg-slate-100 text-slate-600",
};

export default async function MessagesPage() {
  const messages = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const configured = { sms: !!process.env.MSG91_AUTH_KEY, whatsapp: !!process.env.WHATSAPP_TOKEN };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">SMS / WhatsApp log</h1>
      <div className="card p-4 text-sm">
        <p>
          SMS (MSG91): {configured.sms ? <b className="text-green-700">connected</b> : <b className="text-amber-700">not set up</b>} · WhatsApp:{" "}
          {configured.whatsapp ? <b className="text-green-700">connected</b> : <b className="text-amber-700">not set up</b>}
        </p>
        {(!configured.sms || !configured.whatsapp) && (
          <p className="mt-1 text-slate-500">
            Until a provider is connected, messages are only recorded here (status LOGGED) and not delivered. Add the keys and template IDs in
            the server&apos;s .env file.
          </p>
        )}
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Channel</th>
              <th>To</th>
              <th>Event</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">No messages yet.</td>
              </tr>
            )}
            {messages.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(m.createdAt)}</td>
                <td>{m.channel}</td>
                <td>{m.to}</td>
                <td className="text-xs">{m.event}</td>
                <td className="max-w-md text-xs">{m.event === "OTP" ? "•••••• (hidden)" : m.body}</td>
                <td>
                  <span className={`badge ${STATUS[m.status] ?? ""}`} title={m.error ?? ""}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
