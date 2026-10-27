import { Initials, StatusBadge } from "../components/ui/Brand";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MailPlus,
  RefreshCw,
  UserRoundPlus,
  ShieldCheck,
  Send,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { fetchOrganizationInvitations } from "../lib/records";
import { buttonClass, inputClass } from "./AuthPage";

const roleNames: Record<string, string> = {
  patient: "Paciente",
  professional: "Profissional",
  receptionist: "Recepcionista",
};
function queryErrorDetails(error: unknown) {
  if (!error || typeof error !== "object")
    return "Falha de conexão. Tente atualizar a lista.";
  const code = "code" in error ? String(error.code) : "";
  const message =
    "message" in error ? String(error.message) : "Falha de conexão.";
  if (["42P01", "PGRST205", "42883", "PGRST202"].includes(code))
    return (
      "A estrutura de convites está incompleta no banco. Aplique a migração de convites. Detalhe: " +
      code +
      " — " +
      message
    );
  if (code === "42501")
    return (
      "O banco recusou a leitura dos convites. Confira as permissões da conta autenticada e a política de administrador da clínica. Detalhe: " +
      code +
      " — " +
      message
    );
  return (code ? code + " — " : "") + message;
}
export default function UsersPage({
  organizationId,
}: {
  organizationId: string;
}) {
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const invitations = useQuery({
    queryKey: ["invitations", organizationId],
    queryFn: () => fetchOrganizationInvitations(organizationId),
  });
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          organization_id: organizationId,
          email: String(values.get("email")).trim().toLowerCase(),
          full_name: String(values.get("full_name")).trim(),
          role: values.get("role"),
        },
      });
      if (error) {
        let detail =
          "Não foi possível enviar. O administrador precisa conferir a configuração do envio de convites no Supabase.";
        if (error.context instanceof Response) {
          try {
            const body = await error.context.json();
            if (typeof body.error === "string") detail = body.error;
            else if (error.context.status === 404 || body.code === "NOT_FOUND")
              detail =
                "A função de envio ainda não foi publicada no Supabase. Publique a Edge Function invite-user para ativar os convites.";
            else if (typeof body.message === "string") detail = body.message;
          } catch {
            /* Resposta sem JSON: mantém a orientação de configuração. */
          }
        }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(String(data.error));
      if (!data?.invitation_id)
        throw new Error("O servidor não confirmou o envio do convite.");
      setMessage(String(data.message));
      form.reset();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível enviar o convite.",
      );
    } finally {
      setBusy(false);
      await cache.invalidateQueries({
        queryKey: ["invitations", organizationId],
      });
    }
  }
  const all = invitations.data || [];
  const matching = all.filter(
    (i) =>
      (!filter || i.status === filter) &&
      `${i.full_name} ${i.email}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const pages = Math.max(1, Math.ceil(matching.length / 7));
  const current = Math.min(page, pages);
  return (
    <>
      <div className="surface users-summary">
        <div>
          <strong>{invitations.isSuccess ? all.length : "—"}</strong>
          <small>Convites registrados</small>
        </div>
        <span />
        <div>
          <strong>
            {invitations.isSuccess
              ? all.filter((i) => i.status === "sent" || i.status === "sending")
                  .length
              : "—"}
          </strong>
          <small>Aguardando aceite</small>
        </div>
        <span />
        <div>
          <strong>
            {invitations.isSuccess
              ? all.filter((i) => i.status === "accepted").length
              : "—"}
          </strong>
          <small>Convites aceitos</small>
        </div>
        <small className="summary-note">Todos os convites da clínica</small>
      </div>
      <div className="users-layout">
        <section className="surface">
          <div className="surface-header">
            <div>
              <h2>Convites da clínica</h2>
              <p>Acompanhe cada novo acesso, do envio ao aceite.</p>
            </div>
            <button
              type="button"
              onClick={() => void invitations.refetch()}
              disabled={invitations.isFetching}
              className="icon-button"
              aria-label="Atualizar convites"
            >
              <RefreshCw
                size={16}
                className={invitations.isFetching ? "animate-spin" : ""}
              />
            </button>
          </div>
          <div className="collection-toolbar">
            <label className="collection-search">
              <Search size={16} />
              <input
                aria-label="Buscar convites"
                placeholder="Buscar nome ou e-mail..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <select
              aria-label="Filtrar convites por situação"
              className="filter-select"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os convites</option>
              <option value="sent">Enviados</option>
              <option value="accepted">Aceitos</option>
              <option value="failed">Falharam</option>
              <option value="sending">Em envio</option>
            </select>
          </div>
          {invitations.isPending ? (
            <div className="empty-panel" role="status">
              Carregando convites...
            </div>
          ) : invitations.error ? (
            <div role="alert" className="feedback feedback-warning m-5">
              Não foi possível carregar os convites.
              <details>
                <summary>Ver detalhes</summary>
                {queryErrorDetails(invitations.error)}
              </details>
            </div>
          ) : !matching.length ? (
            <div className="empty-panel">
              <span className="empty-icon">
                <MailPlus size={27} />
              </span>
              <h3>
                {search || filter
                  ? "Nenhum convite encontrado"
                  : "O próximo acesso começa aqui"}
              </h3>
              <p>
                {search || filter
                  ? "Experimente outro termo ou situação."
                  : "Preencha o formulário para convidar alguém para sua clínica."}
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table invitations-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Perfil</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {matching
                    .slice((current - 1) * 7, current * 7)
                    .map((invite) => (
                      <tr key={invite.id}>
                        <td>
                          <div className="person-cell">
                            <Initials name={invite.full_name} />
                            <div>
                              <strong>{invite.full_name}</strong>
                              <small>{invite.email}</small>
                            </div>
                          </div>
                          <span className="invitation-date">
                            {new Date(invite.created_at).toLocaleDateString(
                              "pt-BR",
                            )}
                          </span>
                        </td>
                        <td>
                          <span className="role-label">
                            {roleNames[invite.role] || invite.role}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={invite.status} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="surface-bottom">
            <span>
              {matching.length} convite{matching.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                aria-label="Página anterior"
                className="icon-button"
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft size={15} />
              </button>
              <span>
                {current} / {pages}
              </span>
              <button
                aria-label="Próxima página"
                className="icon-button"
                disabled={current >= pages}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </section>
        <section className="surface users-form-section">
          <div className="users-form-icon">
            <UserRoundPlus size={21} />
          </div>
          <h2>Convidar usuário</h2>
          <p>
            Uma equipe conectada começa com um convite. A pessoa define a
            própria senha pelo e-mail e confirma se deseja entrar na clínica.
            Para reenviar um convite pendente, informe novamente o mesmo e-mail e perfil.
          </p>
          <form onSubmit={invite} className="users-form">
            <label className="field-label">
              Nome completo
              <input
                name="full_name"
                autoComplete="off"
                required
                minLength={2}
                maxLength={120}
                placeholder="Como a pessoa se chama?"
                className={inputClass}
              />
            </label>
            <label className="field-label">
              E-mail
              <input
                name="email"
                type="email"
                autoComplete="off"
                required
                maxLength={254}
                placeholder="nome@exemplo.com"
                className={inputClass}
              />
            </label>
            <label className="field-label">
              Perfil de acesso
              <select name="role" defaultValue="patient" className={inputClass}>
                {Object.entries(roleNames).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p role="alert" className="feedback feedback-error">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="feedback feedback-success">
                {message}
              </p>
            )}
            <button
              disabled={busy || !invitations.isSuccess}
              className={`${buttonClass} w-full`}
            >
              <Send size={15} />
              {busy ? "Enviando convite..." : "Enviar convite"}
            </button>
          </form>
          {!invitations.isSuccess && (
            <p className="field-help mt-3">
              {invitations.isPending
                ? "Verificando os convites da clínica..."
                : "O envio será liberado quando a lista carregar."}
            </p>
          )}
          <div className="users-form-note">
            <ShieldCheck size={15} />
            <span>
              Após o aceite, associe pacientes e profissionais ao cadastro
              correspondente para liberar os dados do portal.
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
