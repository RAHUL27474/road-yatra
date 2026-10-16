import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { WHATSAPP_TEMPLATES } from "@/lib/notify";

const STATUS: Record<string, string> = {
  SENT: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  LOGGED: "bg-slate-100 text-slate-600",
};

export default async function MessagesPage() {
  const messages = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const connected = !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;

  return (
    <div className="space-y-4">
      <h1 className="page-title">WhatsApp log</h1>
      <div className="card space-y-3 p-4 text-sm">
        <p>
          WhatsApp Cloud API: {connected ? <b className="text-green-700">connected</b> : <b className="text-amber-700">not set up</b>}
          {!connected && (
            <span className="text-slate-500">
              {" "}
              — until it is, messages are only recorded below (status LOGGED) and not delivered. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID
              in the hosting settings.
            </span>
          )}
        </p>
        <details open={!connected}>
          <summary className="cursor-pointer font-semibold text-brand">Message templates ({WHATSAPP_TEMPLATES.filter((t) => process.env[`WHATSAPP_TEMPLATE_${t.event}`]).length}/{WHATSAPP_TEMPLATES.length} set up)</summary>
          <table className="table mt-2 text-xs">
            <thead>
              <tr>
                <th>Setting name</th>
                <th>Sent to</th>
                <th>Meta category</th>
                <th>Variables {"{{1}}, {{2}}…"}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {WHATSAPP_TEMPLATES.map((t) => (
                <tr key={t.event}>
                  <td className="font-mono">WHATSAPP_TEMPLATE_{t.event}</td>
                  <td>{t.to}</td>
                  <td>{t.category}</td>
                  <td>{t.vars.map((v, i) => `{{${i + 1}}} ${v}`).join(", ")}</td>
                  <td>{process.env[`WHATSAPP_TEMPLATE_${t.event}`] ? <b className="text-green-700">set</b> : <b className="text-amber-700">missing</b>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
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
