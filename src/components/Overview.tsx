import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  Clock3,
  Plus,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react";
import { Initials, StatusBadge } from "./ui/Brand";
export type ClinicalRecord = {
  id: string;
  organization_id: string;
  module: string;
  payload: Record<string, string>;
  created_at: string;
};
function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export default function Overview({
  records,
  base,
  loading,
  failed,
}: {
  records: ClinicalRecord[];
  base: string;
  loading: boolean;
  failed: boolean;
}) {
  const [day, setDay] = useState(localDate(new Date()));
  const today = localDate(new Date());
  const appointments = records
    .filter(
      (r) =>
        r.module === "consultas" && r.payload.starts_at?.slice(0, 10) === day,
    )
    .sort((a, b) => a.payload.starts_at.localeCompare(b.payload.starts_at));
  const active = appointments.filter((r) => r.payload.status !== "Cancelada");
  const waiting = active.filter((r) => r.payload.status === "Em espera");
  const paid = records
    .filter(
      (r) =>
        r.module === "pagamentos" &&
        r.payload.status === "Pago" &&
        r.payload.date === day,
    )
    .reduce((n, r) => n + Number(r.payload.amount || 0), 0);
  const patientCount = records.filter((r) => r.module === "pacientes").length;
  const lookup = (id?: string) =>
    records.find((r) => r.id === id)?.payload.name || "Não informado";
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() - 6 + i);
    return {
      date,
      count: records.filter(
        (r) =>
          r.module === "consultas" &&
          r.payload.status !== "Cancelada" &&
          r.payload.starts_at?.slice(0, 10) === localDate(date),
      ).length,
    };
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  const unavailable = loading || failed;
  return (
    <div className="overview">
      <div className="overview-toolbar">
        <div className="live-label">
          <span />
          {day === today
            ? "Seu dia, em tempo real"
            : "Resumo do período selecionado"}
        </div>
        <label className="date-control">
          <CalendarDays size={16} />
          <span className="sr-only">Data do resumo</span>
          <input
            type="date"
            required
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
        </label>
      </div>
      <div className="metric-grid">
        {[
          {
            label: "Consultas do dia",
            value: active.length,
            note: `${active.filter((r) => r.payload.status === "Confirmada").length} confirmadas`,
            icon: CalendarDays,
            color: "teal",
          },
          {
            label: "Pacientes cadastrados",
            value: patientCount,
            note: "Base de pacientes da clínica",
            icon: Users,
            color: "blue",
          },
          {
            label: "Aguardando atendimento",
            value: waiting.length,
            note: "Pacientes na fila do dia",
            icon: Clock3,
            color: "amber",
          },
          {
            label: "Recebido no dia",
            value: currency(paid),
            note: "Pagamentos marcados como pagos",
            icon: Wallet,
            color: "purple",
          },
        ].map((item) => (
          <div key={item.label} className="metric-card">
            <div className="metric-top">
              <span>{item.label}</span>
              <span className={`metric-icon metric-${item.color}`}>
                <item.icon size={19} />
              </span>
            </div>
            <strong>{unavailable ? "—" : item.value}</strong>
            <small>{unavailable ? "Aguardando dados" : item.note}</small>
          </div>
        ))}
      </div>
      <div className="overview-columns">
        <section className="surface schedule-surface">
          <div className="surface-header">
            <div>
              <h2>
                Agenda do dia{" "}
                <span className="count-pill">
                  {unavailable ? "—" : appointments.length}
                </span>
              </h2>
              <p>Todos os atendimentos em um só lugar.</p>
            </div>
            <Link to={`${base}/agenda`} className="text-link">
              Ver agenda <ArrowUpRight size={15} />
            </Link>
          </div>
          {loading ? (
            <div className="empty-panel" role="status">
              Carregando sua agenda...
            </div>
          ) : failed ? (
            <div className="empty-panel">
              A agenda ficará disponível quando a conexão for restabelecida.
            </div>
          ) : appointments.length ? (
            <div className="table-scroll">
              <table className="data-table schedule-table">
                <thead>
                  <tr>
                    <th>Horário</th>
                    <th>Paciente / profissional</th>
                    <th>Situação</th>
                    <th>
                      <span className="sr-only">Acessar consulta</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.slice(0, 7).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="appointment-time">
                          {r.payload.starts_at.slice(11, 16)}
                        </span>
                      </td>
                      <td>
                        <div className="person-cell">
                          <Initials name={lookup(r.payload.patient_id)} />
                          <div>
                            <strong>{lookup(r.payload.patient_id)}</strong>
                            <small>{lookup(r.payload.professional_id)}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={r.payload.status} />
                      </td>
                      <td>
                        <Link
                          className="table-arrow"
                          aria-label={`Abrir consulta de ${lookup(r.payload.patient_id)}`}
                          to={`${base}/consultas/${r.id}`}
                        >
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-panel">
              <span className="empty-icon">
                <CalendarDays size={28} />
              </span>
              <h3>Uma agenda pronta para começar</h3>
              <p>
                Nenhuma consulta para esta data.
                <br />
                Agende o próximo cuidado.
              </p>
              <Link
                className="button button-secondary"
                to={`${base}/consultas/nova`}
              >
                <Plus size={16} />
                Agendar consulta
              </Link>
            </div>
          )}
          <div className="surface-bottom">
            <span>
              {appointments.length > 7
                ? "Exibindo os primeiros 7 atendimentos."
                : "Organização para cada etapa do atendimento."}
            </span>
            <CheckCheck size={16} />
          </div>
        </section>
        <div className="overview-right">
          <section className="surface">
            <div className="surface-header">
              <div>
                <h2>Movimento da agenda</h2>
                <p>Últimos 7 dias até a data selecionada.</p>
              </div>
            </div>
            <div
              className="activity-chart"
              role="img"
              aria-label={
                unavailable
                  ? "Dados indisponíveis"
                  : days
                      .map(
                        (d) =>
                          `${d.date.toLocaleDateString("pt-BR")}: ${d.count} consultas`,
                      )
                      .join("; ")
              }
            >
              {days.map((d, i) => (
                <div className="chart-column" key={i}>
                  <span>{unavailable ? "—" : d.count}</span>
                  <div className="chart-track">
                    <div
                      className={
                        i === 6 ? "chart-bar chart-bar-today" : "chart-bar"
                      }
                      style={{
                        height:
                          unavailable || !d.count
                            ? "3px"
                            : `${Math.max(5, (d.count / max) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>
                    {d.date
                      .toLocaleDateString("pt-BR", { weekday: "short" })
                      .replace(".", "")}
                  </small>
                </div>
              ))}
            </div>
          </section>
          <section className="quick-start">
            <span className="quick-start-label">
              SUA CLÍNICA, MAIS CONECTADA
            </span>
            <h2>
              Uma boa equipe
              <br />
              faz toda a diferença.
            </h2>
            <p>Convide as pessoas que fazem parte do seu atendimento.</p>
            <Link to={`${base}/usuarios`}>
              Gerenciar equipe <ArrowRight size={17} />
            </Link>
            <div className="quick-start-decoration" aria-hidden="true">
              <Users size={92} strokeWidth={0.7} />
            </div>
          </section>
        </div>
      </div>
      <section className="quick-actions">
        <div>
          <h2>O que vamos organizar agora?</h2>
          <p>Atalhos para simplificar sua rotina.</p>
        </div>
        <Link to={`${base}/pacientes/novo`}>
          <span>
            <Users size={19} />
          </span>
          <div>
            <strong>Novo paciente</strong>
            <small>Amplie sua base de cuidados</small>
          </div>
          <ArrowUpRight size={16} />
        </Link>
        <Link to={`${base}/profissionais/novo`}>
          <span>
            <Stethoscope size={19} />
          </span>
          <div>
            <strong>Novo profissional</strong>
            <small>Organize sua equipe clínica</small>
          </div>
          <ArrowUpRight size={16} />
        </Link>
      </section>
    </div>
  );
}
