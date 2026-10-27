import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
export default function PortalRoleControl({ organizationId, userId, initialRole, initialStatus }: { organizationId: string; userId: string; initialRole: string; initialStatus: string }) {
  const cache=useQueryClient();
  const [role,setRole]=useState(initialRole), [status,setStatus]=useState(initialStatus), [busy,setBusy]=useState(false), [feedback,setFeedback]=useState(""), [failed,setFailed]=useState(false);
  async function save() {
    if (busy) return;
    if (role!==initialRole && !window.confirm("Alterar o perfil remove o vínculo com o cadastro anterior. Continuar?")) return;
    setBusy(true); setFeedback(""); setFailed(false);
    try {
      const {error}=await supabase.rpc("medsync_set_portal_access",{p_org:organizationId,p_user:userId,p_role:role,p_status:status});
      if(error) throw error;
      setFeedback("Acesso atualizado.");
      await Promise.all([cache.invalidateQueries({queryKey:["portal-members",organizationId]}),cache.invalidateQueries({queryKey:["portal-access",organizationId]}),cache.invalidateQueries({queryKey:["access-events",organizationId]})]);
    } catch(error) {setFailed(true);setFeedback(error && typeof error==="object" && "message" in error ? String(error.message) : "Não foi possível atualizar.");} finally {setBusy(false);}
  }
  return <div><div className="access-controls">
    <label className="field-label">Perfil<select className="form-input" value={role} onChange={event=>setRole(event.target.value)} disabled={busy}><option value="patient">Paciente</option><option value="professional">Profissional</option><option value="receptionist">Recepção</option></select></label>
    <label className="field-label">Acesso<select className="form-input" value={status} onChange={event=>setStatus(event.target.value)} disabled={busy}><option value="active">Ativo</option><option value="suspended">Suspenso</option></select></label>
    <button type="button" className="button button-secondary" disabled={busy || (role===initialRole && status===initialStatus)} onClick={()=>void save()}>{busy ? "Salvando..." : "Salvar acesso"}</button>
  </div>{feedback && <p role={failed ? "alert" : "status"}>{feedback}</p>}</div>;
}
