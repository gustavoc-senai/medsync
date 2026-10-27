type ScheduleRecord = { id: string; module: string; payload: Record<string, string> };
export function filterAppointments(records: ScheduleRecord[], day: string, professional: string, status: string, search: string) {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const names = new Map(records.filter((record) => record.module === "pacientes").map((record) => [record.id, record.payload.name || ""]));
  return records.filter((record) => record.module === "consultas" &&
    record.payload.starts_at?.slice(0, 10) === day &&
    (!professional || record.payload.professional_id === professional) &&
    (!status || record.payload.status === status) &&
    (!query || (names.get(record.payload.patient_id) || "").toLocaleLowerCase("pt-BR").includes(query)),
  ).sort((a, b) => a.payload.starts_at.localeCompare(b.payload.starts_at));
}

export function appointmentEndTime(startsAt: string, duration: string) {
  const minutes = Number(duration || 30);
  const start = new Date(startsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(minutes) || minutes < 1 || minutes > 480) return "";
  return new Date(start.getTime() + minutes * 60_000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function appointmentQuery(day: string, professional: string) {
  const params = new URLSearchParams({ starts_at: `${day}T09:00` });
  if (professional) params.set("professional_id", professional);
  return params.toString();
}
