import Link from "next/link";
import { retryReminders } from "../actions";
import { getSql } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { offsetLabel } from "@/lib/i18n/labels";
import { shortDateTime } from "@/lib/time";

const filters = [
  { key: "all", label: "Todos" },
  { key: "failed", label: "Não enviados" },
  { key: "pending", label: "Agendados" },
  { key: "sent", label: "Enviados" },
  { key: "skipped", label: "Ignorados" },
];

const statusLabel: Record<string, string> = {
  pending: "Agendado",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Não enviado",
  skipped: "Ignorado",
};

const reasons: Record<string, string> = {
  channel_unavailable: "Canal não configurado",
  no_phone: "Usuário sem celular cadastrado",
  limit_reached: "Limite mensal atingido",
  too_late: "O compromisso já tinha passado",
  created_late: "Criado depois da hora do aviso",
  activity_missing: "Compromisso excluído",
};

const channelNames: Record<string, string> = { email: "Email", whatsapp: "WhatsApp", sms: "SMS" };

type Row = {
  id: string;
  channel: string;
  delivered_via: string | null;
  offset_minutes: number;
  send_at: Date;
  status: string;
  attempts: number;
  error: string | null;
  title: string;
  email: string;
};

export default async function AdminReminders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const admin = await requireAdmin();
  const { status = "all" } = await searchParams;
  const active = filters.some((f) => f.key === status) ? status : "all";
  const sql = getSql();
  const rows = await sql<Row[]>`
    select r.id, r.channel, r.delivered_via, r.offset_minutes, r.send_at, r.status, r.attempts, r.error,
      a.title, u.email
    from reminders r
    join activities a on a.id = r.activity_id
    join users u on u.id = r.user_id
    where ${active === "all"} or r.status = ${active}
    order by r.send_at desc
    limit 200`;
  const failedCount = rows.filter((r) => r.status === "failed").length;

  return (
    <section className="panel">
      <nav className="chips" aria-label="Filtrar por situação" style={{ marginTop: 0 }}>
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/pt/admin/reminders" : `/pt/admin/reminders?status=${f.key}`}
            className={`filter ${active === f.key ? "filter--on" : ""}`}
            aria-current={active === f.key ? "page" : undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {failedCount > 0 && (
        <form action={retryReminders} style={{ marginTop: "1rem" }}>
          <input type="hidden" name="id" value="all-failed" />
          <button type="submit" className="button button--quiet button--small">
            Tentar de novo todos os não enviados
          </button>
        </form>
      )}
      {rows.length === 0 ? (
        <p className="soft" style={{ marginTop: "1.25rem" }}>
          Nenhum aviso nesta situação.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Envio</th>
                <th>Usuário</th>
                <th>Compromisso</th>
                <th>Canal</th>
                <th>Situação</th>
                <th>Detalhe</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const via = r.delivered_via && r.delivered_via !== r.channel ? ` (foi por ${channelNames[r.delivered_via] ?? r.delivered_via})` : "";
                return (
                  <tr key={r.id}>
                    <td>{shortDateTime(r.send_at, admin.timezone, "pt")}</td>
                    <td>{r.email}</td>
                    <td>
                      {r.title}
                      <br />
                      <span className="soft">{offsetLabel(r.offset_minutes, "pt")}</span>
                    </td>
                    <td>
                      {channelNames[r.channel] ?? r.channel}
                      {via}
                    </td>
                    <td>
                      <span className={`badge ${r.status === "sent" ? "badge--on" : r.status === "pending" || r.status === "sending" ? "" : "badge--off"}`}>
                        {statusLabel[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="detail">{r.error ? (reasons[r.error] ?? r.error) : "—"}</td>
                    <td className="row-actions">
                      {r.status === "failed" && (
                        <form action={retryReminders}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="linklike">
                            Tentar de novo
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint" style={{ marginTop: "1rem" }}>
        Mostra os 200 avisos mais recentes. Um aviso reenviado depois de 1 hora do início do compromisso é ignorado.
      </p>
    </section>
  );
}
