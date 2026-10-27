import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  FileText,
  FolderOpen,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { Initials, StatusBadge } from "../components/ui/Brand";
import { modules, type Field } from "../lib/modules";
import { supabase } from "../lib/supabase";
import {
  fetchOrganizationRecords,
  openPrivateAttachment,
  uploadPrivateAttachment,
} from "../lib/records";
import type { ClinicalRecord } from "../components/Overview";
import AdminPages from "./AdminPages";
type Context = { id: string; name: string; role: string; user: User };
function message(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Não foi possível concluir. Tente novamente.";
}
export default function PortalPage({
  organization,
}: {
  organization: Context;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const role = organization.role;
  const patient = role === "patient";
  const doctor = role === "professional";
  const reception = role === "receptionist";
  const base = patient ? "/paciente" : doctor ? "/profissional" : "/recepcao";
  const parts = pathname.split("/").filter(Boolean);
  const segment = parts[1] || "dashboard";
  const id = parts[2];
  const editing = parts[3] === "editar";
  const creating = id === "novo" || id === "nova";
  const key = [
    "agenda",
    "atendimentos",
    "historico",
    "fila-atendimento",
  ].includes(segment)
    ? "consultas"
    : segment;
  const definition = modules[key];
  const home = segment === "dashboard";
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setSearch("");
    setError("");
    setNotice("");
  }, [pathname]);
  const link = useQuery({
    queryKey: ["portal-link", organization.id, organization.user.id],
    enabled: !reception,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medsync_portal_links")
        .select("record_id")
        .eq("organization_id", organization.id)
        .eq("user_id", organization.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const records = useQuery({
    queryKey: ["portal-records", organization.id, organization.user.id],
    enabled: reception || !!link.data?.record_id,
    queryFn: () => fetchOrganizationRecords(organization.id),
  });
  const catalog = useQuery({
    queryKey: ["portal-catalog", organization.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("medsync_portal_catalog", {
        p_organization_id: organization.id,
      });
      if (error) throw error;
      return data as {
        id: string;
        payload: { name: string; specialty?: string };
      }[];
    },
  });
  const list = records.data || [];
  const selected = list.find((r) => r.id === id && r.module === key);
  const rows = list
    .filter(
      (r) =>
        r.module === key &&
        (!search ||
          JSON.stringify(r.payload)
            .toLocaleLowerCase("pt-BR")
            .includes(search.toLocaleLowerCase("pt-BR"))),
    )
    .filter((r) => segment !== "historico" || r.payload.status === "Concluída")
    .filter(
      (r) =>
        segment !== "fila-atendimento" ||
        ["Em espera", "Em atendimento"].includes(r.payload.status),
    )
    .sort((a, b) =>
      key === "consultas"
        ? (a.payload.starts_at || "").localeCompare(b.payload.starts_at || "")
        : b.created_at.localeCompare(a.created_at),
    );
  const reference = (id?: string) =>
    list.find((r) => r.id === id)?.payload.name ||
    catalog.data?.find((r) => r.id === id)?.payload.name ||
    "Não informado";
  const label = (r: ClinicalRecord) =>
    r.payload.name ||
    (r.payload.patient_id ? reference(r.payload.patient_id) : "Registro");
  const fields =
    definition?.fields.filter((f) => f.key !== "professional_id" || !doctor) ||
    [];
  const mayWrite = reception
    ? ["pacientes", "consultas", "pagamentos"].includes(key)
    : doctor && (!!definition?.clinical || key === "disponibilidade");
  const permitted =
    home ||
    ["perfil", "seguranca"].includes(segment) ||
    (patient &&
      [
        "consultas",
        "historico",
        "agendar",
        "receitas",
        "exames",
        "atestados",
        "documentos",
        "pagamentos",
      ].includes(segment)) ||
    (doctor &&
      [
        "consultas",
        "agenda",
        "atendimentos",
        "fila-atendimento",
        "pacientes",
        "disponibilidade",
        "prontuario",
        "receitas",
        "exames",
        "atestados",
        "documentos",
      ].includes(segment)) ||
    (reception &&
      [
        "agenda",
        "consultas",
        "fila-atendimento",
        "pacientes",
        "pagamentos",
      ].includes(segment));
  const title = home
    ? patient
      ? "Seu cuidado, em dia."
      : doctor
        ? "Sua rotina de atendimento."
        : "Um atendimento bem organizado."
    : segment === "agendar"
      ? "Solicitar consulta"
      : segment === "perfil"
        ? "Meu perfil"
        : segment === "seguranca"
          ? "Segurança da conta"
          : segment === "historico"
            ? "Histórico de consultas"
            : segment === "fila-atendimento"
              ? "Fila de atendimento"
              : segment === "agenda"
                ? "Minha agenda"
                : definition?.title || "Página não encontrada";
  const userName = String(
    organization.user.user_metadata.full_name ||
      organization.user.email?.split("@")[0] ||
      "Meu acesso",
  );
  async function refresh() {
    await cache.invalidateQueries({
      queryKey: ["portal-records", organization.id],
    });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const fileValue = formData.get("attachment");
    const attachment =
      fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    const payload = Object.fromEntries(
      [...formData.entries()]
        .filter(([fieldName]) => fieldName !== "attachment")
        .map(([fieldName, value]) => [fieldName, String(value)]),
    ) as Record<string, string>;
    if (selected?.payload.storage_path) {
      payload.storage_path = selected.payload.storage_path;
      payload.attachment_name = selected.payload.attachment_name || "";
      payload.attachment_type = selected.payload.attachment_type || "";
    }
    try {
      if (!mayWrite) throw new Error("Seu perfil não permite esta alteração.");
      if (doctor) payload.professional_id = link.data!.record_id;
      if (
        payload.ends_at &&
        payload.starts_at &&
        payload.ends_at <= payload.starts_at
      )
        throw new Error("O fim precisa ser posterior ao início.");
      const result = selected
        ? await supabase
            .from("medsync_records")
            .update({ payload })
            .eq("id", selected.id)
            .eq("organization_id", organization.id)
            .select("id")
            .single()
        : await supabase
            .from("medsync_records")
            .insert({ organization_id: organization.id, module: key, payload })
            .select("id")
            .single();
      if (result.error) throw result.error;
      if (attachment) {
        const path = await uploadPrivateAttachment(
          organization.id,
          result.data.id,
          attachment,
        );
        const { error: metadataError } = await supabase
          .from("medsync_records")
          .update({
            payload: {
              ...payload,
              storage_path: path,
              attachment_name: attachment.name,
              attachment_type: attachment.type,
            },
          })
          .eq("id", result.data.id)
          .eq("organization_id", organization.id);
        if (metadataError) {
          const { error: cleanupError } = await supabase.storage
            .from("medsync-private")
            .remove([path]);
          if (cleanupError)
            throw new Error(
              `${message(metadataError)} O arquivo foi enviado, mas a limpeza falhou: ${message(cleanupError)}`,
            );
          throw metadataError;
        }
      }
      await refresh();
      navigate(`${base}/${segment}/${result.data.id}`);
      setNotice("Registro salvo com sucesso.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(appointment: ClinicalRecord, status: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.rpc(
        "medsync_portal_appointment_status",
        { p_appointment_id: appointment.id, p_status: status },
      );
      if (error) throw error;
      await refresh();
      setNotice("Situação atualizada.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function field(f: Field) {
    const common = {
      name: f.key,
      defaultValue: selected?.payload[f.key] || "",
      required: f.required,
      className: "form-input",
    };
    const options =
      f.type === "patient"
        ? list
            .filter((r) => r.module === "pacientes")
            .map((r) => ({ value: r.id, label: r.payload.name }))
        : f.type === "professional"
          ? (catalog.data || []).map((r) => ({
              value: r.id,
              label: r.payload.name,
            }))
          : f.options?.map((v) => ({ value: v, label: v }));
    return (
      <label key={f.key} className="field-label">
        {f.label}
        {f.required ? " *" : ""}
        {options ? (
          <select {...common}>
            <option value="">Selecione</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : f.type === "textarea" ? (
          <textarea {...common} rows={6} maxLength={20000} />
        ) : (
          <input
            {...(f.type === "file"
              ? { name: f.key, className: "form-input" }
              : common)}
            type={f.type || "text"}
            accept={
              f.type === "file"
                ? "application/pdf,image/jpeg,image/png"
                : undefined
            }
            min={f.type === "number" ? 0 : undefined}
            step={f.type === "number" ? "0.01" : undefined}
          />
        )}
      </label>
    );
  }
  const pending =
    !reception && !link.isPending && !link.error && !link.data?.record_id;
  const ready = records.isSuccess && (reception || !!link.data?.record_id);
  const appointments = list.filter(
    (r) =>
      r.module === "consultas" &&
      !["Concluída", "Cancelada"].includes(r.payload.status),
  );
  return (
    <AppShell
      base={base}
      segment={segment}
      clinic={organization.name}
      userName={userName}
      email={organization.user.email || ""}
      heading={title}
      description={
        patient
          ? "Seu espaço para acompanhar consultas e registros compartilhados."
          : doctor
            ? "Organize a agenda e registre o cuidado dos seus pacientes."
            : "Pacientes, agendamentos e fila em uma rotina conectada."
      }
      portalRole={role}
      onLogout={async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          setError(error.message);
          return;
        }
        cache.clear();
        navigate("/login");
      }}
      actions={
        patient && home ? (
          <Link className="button button-primary" to={`${base}/agendar`}>
            <Plus size={16} />
            Solicitar consulta
          </Link>
        ) : mayWrite && !id ? (
          <Link
            className="button button-primary"
            to={`${base}/${segment}/novo`}
          >
            <Plus size={16} />
            Novo registro
          </Link>
        ) : undefined
      }
    >
      {error && (
        <p role="alert" className="feedback feedback-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="feedback feedback-success">
          {notice}
        </p>
      )}
      {[link.error, records.error, catalog.error]
        .filter(Boolean)
        .map((e, i) => (
          <div key={i} role="alert" className="feedback feedback-warning">
            Não foi possível carregar todos os dados deste portal.
            <button
              onClick={() => {
                void link.refetch();
                void records.refetch();
                void catalog.refetch();
              }}
            >
              Tentar novamente
            </button>
            <details>
              <summary>Detalhes para a clínica</summary>
              {message(e)} · Verifique se a migração de portais foi aplicada.
            </details>
          </div>
        ))}
      {pending && (
        <div className="feedback feedback-warning">
          Sua conta está vinculada à clínica. Para liberar os dados, o
          administrador precisa associar seu usuário ao cadastro de{" "}
          {patient ? "paciente" : "profissional"} em Usuários e convites.
        </div>
      )}
      {!permitted ? (
        <section className="surface empty-panel">
          <ShieldCheck size={28} />
          <h2 className="mt-4">Esta página não pertence ao seu perfil.</h2>
          <Link className="text-link mt-4" to={`${base}/dashboard`}>
            Voltar ao meu resumo
          </Link>
        </section>
      ) : segment === "seguranca" ? (
        <AdminPages
          page="seguranca"
          records={[]}
          units={[]}
          clinic={organization.name}
          user={organization.user}
          base={base}
          ready={true}
        />
      ) : segment === "perfil" ? (
        <section className="surface profile-form">
          <div className="profile-form-head">
            <Initials name={userName} />
            <div>
              <h2>Meu cadastro de acesso</h2>
              <p>
                {patient
                  ? "Paciente"
                  : doctor
                    ? "Profissional"
                    : "Recepcionista"}
              </p>
            </div>
          </div>
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const name = String(new FormData(e.currentTarget).get("name"));
              setBusy(true);
              setError("");
              try {
                const { error } = await supabase.auth.updateUser({
                  data: { full_name: name },
                });
                if (error) throw error;
                await cache.invalidateQueries({ queryKey: ["organization"] });
                setNotice("Nome atualizado.");
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field-label">
              Nome
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={userName}
                className="form-input"
              />
            </label>
            <label className="field-label">
              E-mail
              <input
                readOnly
                value={organization.user.email || ""}
                className="form-input"
              />
            </label>
            <button disabled={busy} className="button button-primary">
              Salvar alterações
            </button>
          </form>
          <p className="field-help mt-5">
            Alterações no cadastro clínico devem ser solicitadas à clínica.
          </p>
        </section>
      ) : home ? (
        <>
          <div className="portal-welcome">
            <div>
              <span>UM ESPAÇO PARA CUIDAR</span>
              <h2>
                {patient
                  ? "Cada etapa do seu cuidado, mais perto."
                  : "Mais organização para o próximo atendimento."}
              </h2>
              <p>
                {pending
                  ? "Seu acesso está criado. A clínica concluirá o vínculo com seu cadastro."
                  : "Consulte os registros e acompanhe o que vem a seguir."}
              </p>
            </div>
            <img
              src="/images/clinic-interior.png"
              alt="Ambiente clínico ilustrativo acolhedor"
            />
          </div>
          <div className="metric-grid mt-6">
            {[
              {
                label: patient
                  ? "Consultas em aberto"
                  : "Consultas a acompanhar",
                value: appointments.length,
              },
              {
                label: patient
                  ? "Documentos disponíveis"
                  : "Pacientes disponíveis",
                value: patient
                  ? list.filter((r) =>
                      [
                        "receitas",
                        "exames",
                        "atestados",
                        "documentos",
                      ].includes(r.module),
                    ).length
                  : list.filter((r) => r.module === "pacientes").length,
              },
              {
                label: "Aguardando atendimento",
                value: appointments.filter(
                  (r) => r.payload.status === "Em espera",
                ).length,
              },
            ].map((m) => (
              <div className="metric-card" key={m.label}>
                <div className="metric-top">{m.label}</div>
                <strong>{ready ? m.value : "—"}</strong>
                <small>Registros visíveis para seu acesso</small>
              </div>
            ))}
          </div>
          <section className="surface">
            <div className="surface-header">
              <div>
                <h2>Próximos passos</h2>
                <p>Atalhos para o seu dia.</p>
              </div>
            </div>
            <div className="portal-shortcuts">
              <Link to={`${base}/${patient ? "consultas" : "agenda"}`}>
                <CalendarDays size={23} />
                <strong>{patient ? "Minhas consultas" : "Minha agenda"}</strong>
                <ArrowUpRight size={17} />
              </Link>
              <Link
                to={`${base}/${patient ? "documentos" : doctor ? "prontuario" : "pacientes"}`}
              >
                <FileText size={23} />
                <strong>
                  {patient
                    ? "Meus documentos"
                    : doctor
                      ? "Registros clínicos"
                      : "Cadastro de pacientes"}
                </strong>
                <ArrowUpRight size={17} />
              </Link>
              <Link to={`${base}/seguranca`}>
                <ShieldCheck size={23} />
                <strong>Segurança da conta</strong>
                <ArrowUpRight size={17} />
              </Link>
            </div>
          </section>
        </>
      ) : segment === "agendar" ? (
        <section className="surface collection-body">
          <form
            className="record-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const form = e.currentTarget;
              const data = new FormData(form);
              setBusy(true);
              setError("");
              try {
                const { data: appointmentId, error } = await supabase.rpc(
                  "medsync_request_appointment",
                  {
                    p_organization_id: organization.id,
                    p_professional_id: data.get("professional_id"),
                    p_starts_at: data.get("starts_at"),
                  },
                );
                if (error) throw error;
                await refresh();
                navigate(`${base}/consultas/${appointmentId}`);
                setNotice(
                  "Solicitação registrada. A clínica precisa confirmar a disponibilidade.",
                );
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>Solicitar um atendimento</h2>
            <p className="field-help mb-6">
              A solicitação precisa estar dentro da disponibilidade cadastrada
              e respeitar a duração e os intervalos entre consultas. Os
              horários seguem o fuso de Brasília; a clínica ainda confirmará o
              agendamento.
            </p>
            <div className="record-form-fields">
              <label className="field-label">
                Profissional
                <select name="professional_id" required className="form-input">
                  <option value="">Selecione</option>
                  {catalog.data?.map((r) => (
                    <option value={r.id} key={r.id}>
                      {r.payload.name}
                      {r.payload.specialty ? ` · ${r.payload.specialty}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Data e horário
                <input
                  type="datetime-local"
                  name="starts_at"
                  required
                  className="form-input"
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                className="button button-primary"
                disabled={busy || !ready}
              >
                Solicitar consulta <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </section>
      ) : definition ? (
        <section className="surface">
          {(creating || editing) && mayWrite ? (
            <div className="collection-body">
              <Link className="back-link" to={`${base}/${segment}`}>
                <ArrowLeft size={15} />
                Voltar
              </Link>
              {editing && !selected ? (
                <p>Registro não encontrado.</p>
              ) : (
                <form className="record-form" key={pathname} onSubmit={save}>
                  <h2>{editing ? "Editar registro" : "Novo registro"}</h2>
                  <div className="record-form-fields">{fields.map(field)}</div>
                  <div className="form-actions">
                    <Link
                      className="button button-secondary"
                      to={`${base}/${segment}`}
                    >
                      Cancelar
                    </Link>
                    <button
                      className="button button-primary"
                      disabled={busy || !ready}
                    >
                      Salvar registro
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : id ? (
            <div className="collection-body">
              <Link className="back-link" to={`${base}/${segment}`}>
                <ArrowLeft size={15} />
                Voltar
              </Link>
              {selected ? (
                <>
                  <h2 className="text-lg font-semibold text-slate-700">
                    {label(selected)}
                  </h2>
                  <dl className="detail-list">
                    {definition.fields.map((f) => (
                      <div key={f.key}>
                        <dt>{f.label}</dt>
                        <dd>
                          {f.key === "status" ? (
                            <StatusBadge status={selected.payload[f.key]} />
                          ) : f.key.endsWith("_id") ? (
                            reference(selected.payload[f.key])
                          ) : (
                            selected.payload[f.key] || "Não informado"
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {selected.payload.storage_path && (
                    <button
                      type="button"
                      className="button button-secondary mt-4"
                      onClick={async () => {
                        setError("");
                        try {
                          await openPrivateAttachment(
                            selected.payload.storage_path,
                          );
                        } catch (e) {
                          setError(message(e));
                        }
                      }}
                    >
                      Abrir arquivo privado
                    </button>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {mayWrite && (
                      <Link
                        className="button button-secondary"
                        to={`${base}/${segment}/${selected.id}/editar`}
                      >
                        Editar registro
                      </Link>
                    )}
                    {key === "consultas" && (
                      <>
                        {patient &&
                          ["Agendada", "Confirmada"].includes(
                            selected.payload.status,
                          ) && (
                            <button
                              disabled={busy}
                              className="button button-secondary"
                              onClick={() =>
                                void changeStatus(selected, "Cancelada")
                              }
                            >
                              Cancelar consulta
                            </button>
                          )}
                        {doctor &&
                          !["Concluída", "Cancelada"].includes(
                            selected.payload.status,
                          ) && (
                            <>
                              <button
                                disabled={busy}
                                className="button button-primary"
                                onClick={() =>
                                  void changeStatus(selected, "Em atendimento")
                                }
                              >
                                Iniciar atendimento
                              </button>
                              <button
                                disabled={busy}
                                className="button button-secondary"
                                onClick={() =>
                                  void changeStatus(selected, "Concluída")
                                }
                              >
                                Concluir atendimento
                              </button>
                              <Link
                                className="button button-secondary"
                                to={`${base}/prontuario/novo`}
                              >
                                Registrar evolução
                              </Link>
                            </>
                          )}
                        {reception &&
                          ["Agendada", "Confirmada", "Em espera"].includes(
                            selected.payload.status,
                          ) && (
                            <>
                              {["Confirmada", "Em espera", "Cancelada"]
                                .filter((s) => s !== selected.payload.status)
                                .map((s) => (
                                  <button
                                    key={s}
                                    disabled={busy}
                                    className="button button-secondary"
                                    onClick={() =>
                                      void changeStatus(selected, s)
                                    }
                                  >
                                    {s === "Em espera"
                                      ? "Registrar chegada"
                                      : s === "Cancelada"
                                        ? "Cancelar"
                                        : "Confirmar consulta"}
                                  </button>
                                ))}
                            </>
                          )}
                      </>
                    )}
                  </div>
                  {definition.clinical && (
                    <p className="field-help mt-6">
                      Registro do sistema. Prescrições e atestados exigem
                      emissão e assinatura válidas pelo profissional
                      responsável.
                    </p>
                  )}
                </>
              ) : (
                <div className="empty-panel">
                  {records.isPending && !pending
                    ? "Carregando registro..."
                    : "Registro não encontrado ou sem permissão."}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="collection-toolbar">
                <label className="collection-search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar registros do portal"
                    placeholder="Buscar nos registros..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <span className="field-help">{rows.length} registros</span>
              </div>
              {rows.length ? (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Registro</th>
                        <th>Data / horário</th>
                        <th>Situação</th>
                        <th>
                          <span className="sr-only">Abrir</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <div className="person-cell">
                              <Initials name={label(r)} />
                              <div>
                                <strong>{label(r)}</strong>
                                {r.payload.professional_id && (
                                  <small>
                                    {reference(r.payload.professional_id)}
                                  </small>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            {(
                              r.payload.starts_at ||
                              r.payload.date ||
                              r.created_at
                            )
                              .replace("T", " ")
                              .slice(0, 16)}
                          </td>
                          <td>
                            {r.payload.status ? (
                              <StatusBadge status={r.payload.status} />
                            ) : (
                              <span className="text-xs text-slate-400">
                                Registro disponível
                              </span>
                            )}
                          </td>
                          <td>
                            <Link
                              className="table-arrow"
                              aria-label={`Abrir ${label(r)}`}
                              to={`${base}/${segment}/${r.id}`}
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
                    <FolderOpen size={25} />
                  </span>
                  <h3>
                    {!ready
                      ? "Aguardando seus dados"
                      : "Nenhum registro por aqui"}
                  </h3>
                  <p>
                    {pending
                      ? "A clínica precisa concluir o vínculo com seu cadastro."
                      : "Os registros disponíveis para você aparecerão nesta página."}
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <div className="surface empty-panel">
          <CheckCheck size={25} />
          Selecione uma página no menu.
        </div>
      )}
    </AppShell>
  );
}
