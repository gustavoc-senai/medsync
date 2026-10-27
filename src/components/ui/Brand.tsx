import { HeartPulse } from "lucide-react";
import { Link } from "react-router-dom";

export function Brand({
  light = false,
  compact = false,
}: {
  light?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      to="/"
      aria-label="MedSync, página inicial"
      className={`brand ${light ? "brand-light" : ""}`}
    >
      <span className="brand-mark">
        <HeartPulse size={23} strokeWidth={2.2} />
      </span>
      {!compact && (
        <span>
          med<span className="brand-sync">sync</span>
          <span className="brand-dot">.</span>
        </span>
      )}
    </Link>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const good = [
    "Ativo",
    "Confirmada",
    "Concluída",
    "Pago",
    "accepted",
    "sent",
    "access_ready",
  ].includes(status);
  const bad = ["Inativo", "Cancelada", "Cancelado", "failed", "cancelled", "expired"].includes(status);
  const pending = ["Em espera", "Pendente", "sending", "Agendada"].includes(
    status,
  );
  const labels: Record<string, string> = {
    accepted: "Aceito",
    sent: "Enviado",
    failed: "Falhou",
    sending: "Em envio",
    access_ready: "Acesso liberado",
    cancelled: "Cancelado",
    expired: "Expirado",
  };
  return (
    <span
      className={`status-badge ${good ? "status-good" : bad ? "status-bad" : pending ? "status-pending" : "status-neutral"}`}
    >
      <span />
      {labels[status] || status || "Não informado"}
    </span>
  );
}
export function Initials({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const letters =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "MS";
  return (
    <span aria-hidden="true" className={`avatar ${className}`}>
      {letters}
    </span>
  );
}
