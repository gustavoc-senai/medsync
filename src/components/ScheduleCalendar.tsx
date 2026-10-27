import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import type { ClinicalRecord } from "./Overview";
import { Initials, StatusBadge } from "./ui/Brand";
const key = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export default function ScheduleCalendar({
  records,
  base,
  ready,
}: {
  records: ClinicalRecord[];
  base: string;
  ready: boolean;
}) {
  const [day, setDay] = useState(key(new Date()));
  const [professional, setProfessional] = useState("");
  const selectedDate = new Date(day + "T12:00:00");
  const start = new Date(selectedDate);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    return date;
  });
  const appointments = records
    .filter(
      (r) =>
        r.module === "consultas" &&
        r.payload.starts_at?.slice(0, 10) === day &&
        (!professional || r.payload.professional_id === professional),
    )
    .sort((a, b) => a.payload.starts_at.localeCompare(b.payload.starts_at));
  const reference = (id?: string) =>
    records.find((r) => r.id === id)?.payload.name || "Não informado";
  function shift(amount: number) {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + amount);
    setDay(key(date));
  }
  return (
    <section className="surface">
      <div className="calendar-toolbar">
        <div>
          <h2>
            {selectedDate.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="flex items-center gap-1">
            <button
              aria-label="Semana anterior"
              className="icon-button"
              onClick={() => shift(-7)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="button button-secondary"
              onClick={() => setDay(key(new Date()))}
            >
              Hoje
            </button>
            <button
              aria-label="Próxima semana"
              className="icon-button"
              onClick={() => shift(7)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <label className="field-label">
          <span className="sr-only">Filtrar por profissional</span>
          <select
            className="filter-select"
            value={professional}
            onChange={(e) => setProfessional(e.target.value)}
          >
            <option value="">Todos os profissionais</option>
            {records
              .filter((r) => r.module === "profissionais")
              .map((r) => (
                <option value={r.id} key={r.id}>
                  {r.payload.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="calendar-week">
        {days.map((date) => (
          <button
            key={key(date)}
            className={key(date) === day ? "selected" : ""}
            onClick={() => setDay(key(date))}
            aria-pressed={key(date) === day}
          >
            <span>
              {date
                .toLocaleDateString("pt-BR", { weekday: "short" })
                .replace(".", "")}
            </span>
            <strong>{date.getDate()}</strong>
            <small>
              {ready
                ? records.filter(
                    (r) =>
                      r.module === "consultas" &&
                      r.payload.starts_at?.slice(0, 10) === key(date) &&
                      (!professional ||
                        r.payload.professional_id === professional),
                  ).length
                : "—"}
            </small>
          </button>
        ))}
      </div>
      <div className="surface-header">
        <div>
          <h2>
            {selectedDate.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <p>
            {ready
              ? `${appointments.length} consultas nesta data`
              : "Aguardando dados da agenda"}
          </p>
        </div>
        <CalendarDays size={21} className="text-teal-700" />
      </div>
      {!ready ? (
        <div className="empty-panel">Carregando agenda...</div>
      ) : appointments.length ? (
        <div className="calendar-appointments">
          {appointments.map((r) => (
            <Link
              key={r.id}
              to={`${base}/consultas/${r.id}`}
              className={`calendar-appointment ${r.payload.status === "Cancelada" ? "calendar-canceled" : ""}`}
            >
              <time>{r.payload.starts_at.slice(11, 16)}</time>
              <Initials name={reference(r.payload.patient_id)} />
              <div>
                <strong>{reference(r.payload.patient_id)}</strong>
                <small>{reference(r.payload.professional_id)}</small>
              </div>
              <StatusBadge status={r.payload.status} />
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <span className="empty-icon">
            <CalendarDays size={27} />
          </span>
          <h3>Um espaço para o próximo cuidado</h3>
          <p>Não há consultas com os filtros selecionados.</p>
          <Link
            className="button button-secondary"
            to={`${base}/consultas/nova`}
          >
            <Plus size={15} />
            Agendar consulta
          </Link>
        </div>
      )}
    </section>
  );
}
