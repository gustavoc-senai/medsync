import { Initials, StatusBadge } from "../components/ui/Brand";
import { useEffect, useState, type FormEvent } from "react";
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
import type { ClinicalRecord } from "../components/Overview";
import { invitationStatus } from "../lib/invitationStatus";
import { markFormSaved } from "../lib/formEvents";

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
  records = [],
}: {
  organizationId: string;
  records?: ClinicalRecord[];
}) {
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("patient");
  const [recordId, setRecordId] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const linked = useQuery({ queryKey: ["invitation-links", organizationId], queryFn: async () => {
    const { data, error } = await supabase.from("medsync_portal_links").select("user_id").eq("organization_id", organizationId);
    if (error) throw error;
    return new Set<string>((data || []).map((item) => String(item.user_id)));
  }});
  const statusOf = (invite: Parameters<typeof invitationStatus>[0]) => invitationStatus(invite, linked.data || new Set<string>(), now);
  const invitations = useQuery({
    queryKey: ["invitations", organizationId],
    refetchOnWindowFocus: true,
    queryFn: () => fetchOrganizationInvitations(organizationId),
  });
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    await sendInvitation({
      email: String(values.get("email")).trim().toLowerCase(),
      full_name: String(values.get("full_name")).trim(),
      role: String(values.get("role")),
      record_id: String(values.get("record_id") || "") || null,
    }, () => { form.reset(); setRecordId(""); setInviteRole("patient"); markFormSaved(); });
  }
  async function sendInvitation(person: { email: string; full_name: string; role: string; record_id?: string | null }, onSuccess?: () => void) {
    if (busy) return;
    setBusy(true);
    setSendingEmail(person.email);
    setError("");
    setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          organization_id: organizationId,
          email: person.email, full_name: person.full_name, role: person.role, record_id: person.record_id || null,
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
      onSuccess?.();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível enviar o convite.",
      );
    } finally {
      setBusy(false);
      setSendingEmail("");
      await cache.invalidateQueries({
        queryKey: ["invitations", organizationId],
      });
      await cache.invalidateQueries({ queryKey: ["access-events", organizationId] });
    }
  }
  async function cancelInvitation(id: string) {
    if (busy || !window.confirm("Cancelar este convite? A pessoa não poderá mais aceitá-lo.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { error } = await supabase.rpc("medsync_cancel_invitation", { p_id: id });
      if (error) throw error;
      setMessage("Convite cancelado.");
      await cache.invalidateQueries({ queryKey: ["invitations", organizationId] });
      await cache.invalidateQueries({ queryKey: ["access-events", organizationId] });
    } catch (error) { setError(error && typeof error === "object" && "message" in error ? String(error.message) : "Não foi possível cancelar."); }
    finally { setBusy(false); }
  }
  const all = invitations.data || [];
  const matching = all.filter(
    (i) =>
      (!filter || statusOf(i) === filter) &&
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
              <option value="access_ready">Acesso liberado</option>
              <option value="expired">Expirados</option>
              <option value="cancelled">Cancelados</option>
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
                    <th>Ações</th>
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
                          <StatusBadge status={statusOf(invite)} />
                          {invite.expires_at && !["accepted", "access_ready", "cancelled"].includes(statusOf(invite)) && <small className="invitation-date">Validade: {new Date(invite.expires_at).toLocaleDateString("pt-BR")}</small>}
                        </td>
                        <td>
                          {["sent", "sending", "pending", "failed", "expired"].includes(statusOf(invite)) && (
                            <button type="button" className="button button-secondary" disabled={busy}
                              aria-label={`Reenviar convite para ${invite.full_name}`}
                              onClick={() => void sendInvitation(invite)}>
                              {busy && sendingEmail === invite.email ? "Enviando..." : "Reenviar convite"}
                            </button>
                          )}
                          {!["accepted", "access_ready", "cancelled"].includes(statusOf(invite)) && <button type="button" className="button button-secondary" disabled={busy} onClick={() => void cancelInvitation(invite.id)}>Cancelar convite</button>}
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
          <form onSubmit={invite} className="users-form" data-protect-changes>
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
              <select name="role" value={inviteRole} onChange={(event) => { setInviteRole(event.target.value); setRecordId(""); }} className={inputClass}>
                {Object.entries(roleNames).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {inviteRole !== "receptionist" && <label className="field-label">Cadastro para liberar após o aceite
              <select name="record_id" className={inputClass} value={recordId} onChange={(event) => {
                setRecordId(event.target.value);
                const record = records.find((item) => item.id === event.target.value);
                const form = event.currentTarget.form;
                if (record && form) {
                  (form.elements.namedItem("full_name") as HTMLInputElement).value = record.payload.name || "";
                  (form.elements.namedItem("email") as HTMLInputElement).value = record.payload.email || "";
                }
              }}>
                <option value="">Vincular manualmente depois</option>
                {records.filter((item) => item.module === (inviteRole === "patient" ? "pacientes" : "profissionais") && item.payload.status !== "Inativo" && item.payload.email).map((item) => <option key={item.id} value={item.id}>{item.payload.name} — {item.payload.email}</option>)}
              </select>
              <small>Ao selecionar um cadastro, o acesso aos dados será liberado automaticamente após o aceite.</small>
            </label>}
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
