import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
const tables: Record<string, string> = { organization_members: "Perfil da organização", medsync_memberships: "Acesso ao portal", medsync_portal_links: "Vínculo do cadastro", medsync_invitations: "Convite" };
const operations: Record<string, string> = { insert: "criado", update: "atualizado", delete: "removido" };
export default function AccessHistory({ organizationId }: { organizationId: string }) {
  const history = useQuery({ queryKey: ["access-events", organizationId], queryFn: async () => {
    const { data, error } = await supabase.from("medsync_access_events").select("id,action,subject_id,actor_id,details,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data || [];
  }});
  return <section className="surface mt-6">
    <div className="surface-header"><div><h2>Histórico de acessos</h2><p>Até 50 alterações recentes de convites, perfis e vínculos.</p></div>
      <button className="button button-secondary" disabled={history.isFetching} onClick={() => void history.refetch()}>Atualizar histórico</button></div>
    {history.isPending ? <p role="status" className="empty-panel">Carregando histórico...</p> : history.error ? <p role="alert" className="feedback feedback-warning m-5">Não foi possível carregar o histórico. Confira se a atualização do banco foi aplicada e tente novamente.</p> : !history.data?.length ? <p className="empty-panel">As próximas alterações de acesso aparecerão aqui.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Quando</th><th>Alteração</th><th>Detalhes</th></tr></thead><tbody>
      {history.data.map((event) => { const [table, operation] = String(event.action).split("."); return <tr key={event.id}><td>{new Date(event.created_at).toLocaleString("pt-BR")}</td><td>{tables[table] || table} {operations[operation] || operation}<small className="invitation-date">Responsável: {event.actor_id || "Sistema"}</small></td><td>{event.details?.previous_role && event.details.previous_role !== event.details.role ? `${event.details.previous_role} → ` : ""}{event.details?.role || ""}{event.details?.status ? ` · ${event.details.status}` : ""}<small className="invitation-date">Referência: {event.subject_id}</small></td></tr>; })}
    </tbody></table></div>}
  </section>;
}
