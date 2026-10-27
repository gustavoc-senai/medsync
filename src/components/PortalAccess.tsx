import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ClinicalRecord } from "./Overview";
import { Initials, StatusBadge } from "./ui/Brand";
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
}: {
  organizationId: string;
  records: ClinicalRecord[];
}) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const members = useQuery({
    queryKey: ["portal-members", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("medsync_list_portal_users", {
        p_organization_id: organizationId,
      });
      if (error) throw error;
      return data as Member[];
    },
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
        <Link2 size={20} className="text-teal-700" />
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
          {members.data.map((member) => (
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
                </div>
              </div>
              {member.role === "receptionist" ? (
                <StatusBadge status="Ativo" />
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
