import { Link } from "react-router-dom";
import { StatusBadge } from "./ui/Brand";
import type { ClinicalRecord } from "./Overview";
import { formatPortalDate, upcomingAppointments } from "../lib/portalRecords";
export default function PortalHighlights({ records, catalog, role, base, ready, now }: {
  records: ClinicalRecord[]; catalog: {id:string;payload:{name:string}}[]; role:string; base:string; ready:boolean; now:number;
}) {
  const patient=role==="patient";
  const appointments=upcomingAppointments(records,now).slice(0,3);
  const documents=records.filter(record=>["receitas","exames","atestados","documentos"].includes(record.module)).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,3);
  const lookup=(id:string)=>records.find(record=>record.id===id)?.payload.name || catalog.find(record=>record.id===id)?.payload.name || "Não informado";
  return <div className="portal-highlights">
    <section className="surface"><div className="surface-header"><div><h2>{patient ? "Suas próximas consultas" : "Próximos atendimentos"}</h2><p>Horários futuros e atendimentos em andamento hoje.</p></div></div>
      {!ready ? <p className="empty-panel">Aguardando os dados do seu acesso.</p> : appointments.length ? <div className="portal-highlight-list">{appointments.map(record=><Link key={record.id} className="portal-highlight-item" to={`${base}/consultas/${record.id}`}>
        <strong>{formatPortalDate(record.payload.starts_at,true)}</strong>
        <span>{patient ? lookup(record.payload.professional_id) : lookup(record.payload.patient_id)}</span>
        <StatusBadge status={record.payload.status} />
      </Link>)}</div> : <p className="empty-panel">Nenhuma consulta futura encontrada.</p>}
      <div className="surface-bottom"><Link className="text-link" to={`${base}/${patient ? "consultas" : "agenda"}`}>Ver todas as consultas</Link></div>
    </section>
    <section className="surface"><div className="surface-header"><div><h2>{role==="receptionist" ? "Organizar o atendimento" : "Documentos recentes"}</h2><p>{role==="receptionist" ? "Acesso rápido à fila e aos cadastros." : "Itens disponíveis para o seu perfil."}</p></div></div>
      {role==="receptionist" ? <div className="portal-highlight-list"><Link className="portal-highlight-item" to={`${base}/fila-atendimento`}>Abrir fila de atendimento</Link><Link className="portal-highlight-item" to={`${base}/pacientes`}>Consultar pacientes</Link><Link className="portal-highlight-item" to={`${base}/consultas/nova`}>Agendar consulta</Link></div> : !ready ? <p className="empty-panel">Aguardando os dados do seu acesso.</p> : documents.length ? <div className="portal-highlight-list">{documents.map(record=><Link key={record.id} className="portal-highlight-item" to={`${base}/${record.module}/${record.id}`}><strong>{record.payload.name || record.payload.title || ({receitas:"Receita",exames:"Exame",atestados:"Atestado",documentos:"Documento"} as Record<string,string>)[record.module]}</strong><span>{formatPortalDate(record.payload.date || record.created_at)}</span></Link>)}</div> : <p className="empty-panel">Nenhum documento disponível no momento.</p>}
    </section>
  </div>;
}
