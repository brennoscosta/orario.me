import Link from "next/link";
import { getSql } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { configuredChannels } from "@/lib/channels";
import { channels } from "@/lib/plans";

const channelNames = { email: "Email", whatsapp: "WhatsApp", sms: "SMS" } as const;

export default async function AdminOverview() {
  await requireAdmin();
  const sql = getSql();
  const [counts] = await sql<
    { users: number; users_7d: number; activities: number; upcoming: number; pending: number; failed_7d: number }[]
  >`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from users where created_at > now() - interval '7 days') as users_7d,
      (select count(*)::int from activities) as activities,
      (select count(*)::int from activities where starts_at > now()) as upcoming,
      (select count(*)::int from reminders where status = 'pending') as pending,
      (select count(*)::int from reminders where status = 'failed' and send_at > now() - interval '7 days') as failed_7d`;
  const sent = await sql<{ channel: string; n: number }[]>`
    select channel, count(*)::int as n from deliveries
    where sent_at >= date_trunc('month', now()) group by channel`;
  const sentBy = Object.fromEntries(sent.map((r) => [r.channel, r.n]));
  const ready = await configuredChannels();
  const stats = [
    { label: "Usuários", value: counts.users, note: `${counts.users_7d} nos últimos 7 dias` },
    { label: "Compromissos", value: counts.activities, note: `${counts.upcoming} futuros` },
    { label: "Avisos agendados", value: counts.pending, note: "aguardando a hora de envio" },
    { label: "Avisos não enviados", value: counts.failed_7d, note: "falhas nos últimos 7 dias" },
  ];

  return (
    <>
      <dl className="stats">
        {stats.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
            <p>{s.note}</p>
          </div>
        ))}
      </dl>

      <section className="panel">
        <header className="panel-head">
          <h2>Canais de aviso</h2>
          <Link href="/pt/admin/channels">Configurar</Link>
        </header>
        <table className="table">
          <thead>
            <tr>
              <th>Canal</th>
              <th>Situação</th>
              <th className="num">Enviados neste mês</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c}>
                <td>{channelNames[c]}</td>
                <td>
                  <span className={`badge ${ready[c] ? "badge--on" : "badge--off"}`}>{ready[c] ? "Ativo" : "Inativo"}</span>
                </td>
                <td className="num">{sentBy[c] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!ready.email && (
          <p className="alert" style={{ marginTop: "1rem" }}>
            O email está inativo. Sem ele, nenhum aviso é enviado, nem os de WhatsApp e SMS que excedem o limite.
          </p>
        )}
      </section>
    </>
  );
}
