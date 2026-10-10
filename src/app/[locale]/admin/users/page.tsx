import Link from "next/link";
import { deleteUser } from "../actions";
import { getSql } from "@/db";
import { isAdminEmail, requireAdmin } from "@/lib/admin";
import { shortDateTime } from "@/lib/time";

const PAGE = 50;

type Row = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  locale: string;
  created_at: Date;
  activities: number;
  sent: number;
};

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const admin = await requireAdmin();
  const { q = "", page = "1" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const sql = getSql();
  const like = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = await sql<Row[]>`
    select u.id, u.name, u.email, u.phone, u.locale, u.created_at,
      (select count(*)::int from activities a where a.user_id = u.id) as activities,
      (select count(*)::int from deliveries d where d.user_id = u.id and d.sent_at >= date_trunc('month', now())) as sent
    from users u
    where ${query === ""} or u.email ilike ${like} or u.name ilike ${like}
    order by u.created_at desc
    limit ${PAGE + 1} offset ${(pageNumber - 1) * PAGE}`;
  const hasNext = rows.length > PAGE;
  const list = rows.slice(0, PAGE);
  const pageHref = (n: number) => `/pt/admin/users?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(n) })}`;

  return (
    <section className="panel">
      <form className="search" action="/pt/admin/users">
        <label htmlFor="q" className="legend">
          Buscar por nome ou email
        </label>
        <div className="search-row">
          <input id="q" name="q" className="input" defaultValue={query} />
          <button type="submit" className="button button--small">
            Buscar
          </button>
        </div>
      </form>
      {list.length === 0 ? (
        <p className="soft">{query ? "Nenhum usuário encontrado para esta busca." : "Ainda não há usuários cadastrados."}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Celular</th>
                <th>Cadastro</th>
                <th className="num">Compromissos</th>
                <th className="num">Avisos no mês</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const protectedUser = u.id === admin.id || isAdminEmail(u.email);
                return (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.phone ?? "—"}</td>
                    <td>{shortDateTime(u.created_at, admin.timezone, "pt")}</td>
                    <td className="num">{u.activities}</td>
                    <td className="num">{u.sent}</td>
                    <td className="row-actions">
                      {protectedUser ? (
                        <span className="badge badge--on">Admin</span>
                      ) : (
                        <details>
                          <summary>Excluir</summary>
                          <form action={deleteUser} className="confirm">
                            <input type="hidden" name="id" value={u.id} />
                            <p>Excluir {u.email} e todos os compromissos desta conta? Não dá para desfazer.</p>
                            <button type="submit" className="button button--small">
                              Sim, excluir conta
                            </button>
                          </form>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(pageNumber > 1 || hasNext) && (
        <p className="pager">
          {pageNumber > 1 && <Link href={pageHref(pageNumber - 1)}>Página anterior</Link>}
          {hasNext && <Link href={pageHref(pageNumber + 1)}>Próxima página</Link>}
        </p>
      )}
    </section>
  );
}
