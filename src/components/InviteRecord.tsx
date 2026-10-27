import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { ClinicalRecord } from "./Overview";

export default function InviteRecord({ organizationId, record }: { organizationId: string; record: ClinicalRecord }) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function send() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", { body: {
        organization_id: organizationId, record_id: record.id,
        full_name: record.payload.name, email: record.payload.email,
        role: record.module === "pacientes" ? "patient" : "professional",
      } });
      if (error) {
        let detail = "Não foi possível enviar o convite.";
        if (error.context instanceof Response) {
          try { detail = (await error.context.json()).error || detail; } catch { /* keep fallback */ }
        }
        throw new Error(detail);
      }
      if (!data?.invitation_id || data.error) throw new Error(data?.error || "O servidor não confirmou o envio.");
      setMessage("Convite enviado. Ao aceitar, a pessoa terá acesso a este cadastro no próprio painel.");
      await cache.invalidateQueries({ queryKey: ["invitations", organizationId] });
      await cache.invalidateQueries({ queryKey: ["access-events", organizationId] });
    } catch (error) { setError(error instanceof Error ? error.message : "Falha no envio."); }
    finally { setBusy(false); }
  }
  return <section className="surface p-5 mt-5">
    <h3>Acesso ao portal</h3>
    <p>Envie um convite para {record.payload.email || "o e-mail deste cadastro"}. A conta será vinculada a este cadastro após o aceite.</p>
    {!record.payload.email && <p>Edite o cadastro e informe um e-mail antes de convidar.</p>}
    {record.payload.status === "Inativo" && <p>Ative o cadastro antes de convidar.</p>}
    {error && <p role="alert" className="feedback feedback-error">{error}</p>}
    {message && <p role="status" className="feedback feedback-success">{message}</p>}
    <button type="button" className="button button-primary mt-4" disabled={busy || !record.payload.email || record.payload.status === "Inativo"} onClick={() => void send()}>
      {busy ? "Enviando..." : "Convidar para o portal"}
    </button>
  </section>;
}
