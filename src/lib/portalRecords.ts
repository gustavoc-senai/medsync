type PortalRecord = { id: string; module: string; created_at: string; payload: Record<string,string> };
export function upcomingAppointments(records: PortalRecord[], now: number) {
  return records.filter(record => {
    if (record.module !== "consultas" || ["Concluída","Cancelada"].includes(record.payload.status)) return false;
    const time = new Date(record.payload.starts_at).getTime();
    if (!Number.isFinite(time)) return false;
    const sameDay = new Date(time).toDateString() === new Date(now).toDateString();
    return time >= now || (sameDay && ["Em espera","Em atendimento"].includes(record.payload.status));
  }).sort((a,b) => a.payload.starts_at.localeCompare(b.payload.starts_at));
}
export function formatPortalDate(value: string, withTime = false) {
  const date = new Date(value.length === 10 ? value + "T12:00:00" : value);
  if (!Number.isFinite(date.getTime())) return "Data não informada";
  return withTime ? date.toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"}) : date.toLocaleDateString("pt-BR");
}
