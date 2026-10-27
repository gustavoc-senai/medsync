import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ClinicalRecord } from "./Overview";
import { Initials, StatusBadge } from "./ui/Brand";
import PortalRoleControl from "./PortalRoleControl";
type Member = {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  record_id: string | null;
};
export default function PortalAccess({
  organizationId,
  records,
  recordsLoading = false,
  recordsError = false,
}: {
  organizationId: string;
  records: ClinicalRecord[];
  recordsLoading?: boolean;
  recordsError?: boolean;
}) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const access = useQuery({ queryKey: ["portal-access", organizationId], queryFn: async () => {
    const { data, error } = await supabase.from("medsync_memberships").select("user_id,role,status").eq("organization_id", organizationId);
    if (error) throw error;
    return data || [];
  }});
  const members = useQuery({
    queryKey: ["portal-members", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("medsync_list_portal_users", {
        p_organization_id: organizationId,
      });
      if (error) throw error;
      return data as Member[];
    },
    refetchOnWindowFocus: true,
  });
  async function link(event: FormEvent<HTMLFormElement>, member: Member) {
    event.preventDefault();
    if (busy) return;
    const id = String(new FormData(event.currentTarget).get("record_id"));
    setBusy(member.user_id);
    setError("");
    setNotice("");
    try {
      const { error } = await supabase.rpc("medsync_link_portal_user", {
        p_organization_id: organizationId,
        p_user_id: member.user_id,
        p_record_id: id,
      });
      if (error) throw error;
      await cache.invalidateQueries({
        queryKey: ["portal-members", organizationId],
      });
      await cache.invalidateQueries({ queryKey: ["portal-link", organizationId, member.user_id] });
      await cache.invalidateQueries({ queryKey: ["invitation-links", organizationId] });
      await cache.invalidateQueries({ queryKey: ["access-events", organizationId] });
      setNotice(
        "Vínculo atualizado. O usuário poderá acessar os dados desse cadastro.",
      );
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "Não foi possível vincular o cadastro.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="surface mt-6">
      <div className="surface-header">
        <div>
          <h2>Usuários vinculados à clínica</h2>
          <p>
            Associe a conta ao cadastro correto para liberar os dados do portal.
          </p>
        </div>
        <button type="button" className="button button-secondary" disabled={members.isFetching || recordsLoading}
          onClick={() => {
            void members.refetch();
            void cache.invalidateQueries({ queryKey: ["records", organizationId] });
          }}>
          <RefreshCw size={16} /> Atualizar vínculos
        </button>
      </div>
      <div className="portal-access-toolbar">
        <label className="field-label">Buscar usuário
          <input type="search" className="form-input" value={search} placeholder="Nome ou e-mail"
            onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="invitation-confirmation">
          <input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} />
          Apenas aguardando vínculo
        </label>
        {members.data && <span>{members.data.filter((member) => member.role !== "receptionist" && !member.record_id).length} aguardando vínculo</span>}
      </div>
      {error && (
        <p role="alert" className="feedback feedback-error m-5">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="feedback feedback-success m-5">
          {notice}
        </p>
      )}
      {access.error && <p role="alert" className="feedback feedback-warning m-5">Não foi possível carregar os controles de acesso.</p>}
      {members.isPending ? (
        <div className="empty-panel">Carregando vínculos...</div>
      ) : members.error ? (
        <div className="feedback feedback-warning m-5">
          A gestão dos vínculos depende da migração de portais.
          <details>
            <summary>Instruções para ativar</summary>Execute
            supabase/migrations/202610220004_portals.sql no SQL Editor do
            projeto. Nenhuma senha precisa ser alterada.
          </details>
        </div>
      ) : !members.data.length ? (
        <div className="empty-panel">
          <ShieldCheck size={27} />
          <h3 className="mt-4">
            Os usuários aparecerão após aceitar o convite
          </h3>
          <p>
            Depois do aceite, vincule a conta de paciente ou profissional ao
            respectivo cadastro.
          </p>
        </div>
      ) : (
        <div className="portal-member-list">
          {recordsLoading && <p role="status">Carregando cadastros para vincular...</p>}
          {recordsError && <p role="alert">Não foi possível carregar os cadastros. Atualize a página para tentar novamente.</p>}
          {!members.data.some((member) => (!pendingOnly || (member.role !== "receptionist" && !member.record_id)) && `${member.full_name} ${member.email}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))) && <p className="empty-panel">Nenhum usuário encontrado com esses filtros.</p>}
          {members.data.filter((member) => (!pendingOnly || (member.role !== "receptionist" && !member.record_id)) && `${member.full_name} ${member.email}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))).map((member) => (
            <div className="portal-member" key={member.user_id}>
              <div className="person-cell">
                <Initials name={member.full_name || member.email} />
                <div>
                  <strong>{member.full_name || member.email}</strong>
                  <small>
                    {member.email} ·{" "}
                    {member.role === "patient"
                      ? "Paciente"
                      : member.role === "professional"
                        ? "Profissional"
                        : "Recepção"}
                  </small>
                  <small>{access.data?.some((entry) => entry.user_id === member.user_id && entry.status === "suspended") ? "Acesso suspenso" : member.role === "receptionist" || member.record_id ? "Acesso liberado" : "Aguardando vínculo com cadastro"}</small>
                  {access.data?.filter((entry) => entry.user_id === member.user_id).map((entry) => <PortalRoleControl key={`${member.user_id}-${entry.role}-${entry.status}`} organizationId={organizationId} userId={member.user_id} initialRole={String(entry.role)} initialStatus={String(entry.status || "active")} />)}
                </div>
              </div>
              {member.role === "receptionist" ? (
                <StatusBadge status="Ativo" />
              ) : recordsLoading || recordsError ? null : !records.some((record) => record.module === (member.role === "patient" ? "pacientes" : "profissionais")) ? (
                <div>
                  <p>Nenhum cadastro de {member.role === "patient" ? "paciente" : "profissional"} disponível nesta clínica.</p>
                  <Link className="button button-secondary" to={`${member.role === "patient" ? "/app/pacientes/novo" : "/app/profissionais/novo"}?${new URLSearchParams({ name: member.full_name, email: member.email, returnTo: "usuarios" })}`}>
                    {member.role === "patient" ? "Cadastrar paciente" : "Cadastrar profissional"}
                  </Link>
                  <p>Depois, volte aqui e vincule a conta ao cadastro correto.</p>
                </div>
              ) : (
                <form onSubmit={(event) => void link(event, member)}>
                  <label className="sr-only" htmlFor={`link-${member.user_id}`}>
                    Cadastro de {member.full_name || member.email}
                  </label>
                  <select
                    id={`link-${member.user_id}`}
                    name="record_id"
                    key={member.record_id || "new"}
                    required
                    className="form-input"
                    defaultValue={member.record_id || ""}
                  >
                    <option value="">
                      Selecione o cadastro correspondente
                    </option>
                    {records
                      .filter(
                        (r) =>
                          r.module ===
                          (member.role === "patient"
                            ? "pacientes"
                            : "profissionais"),
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.payload.name}
                        </option>
                      ))}
                  </select>
                  <button disabled={!!busy} className="button button-secondary">
                    {busy === member.user_id
                      ? "Salvando..."
                      : member.record_id
                        ? "Atualizar vínculo"
                        : "Vincular cadastro"}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
