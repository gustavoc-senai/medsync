import ScheduleCalendar from "../components/ScheduleCalendar";
import { Navigate } from "react-router-dom";
import PortalPage from "./PortalPage";
import AdminPages, { extraPageTitles } from "./AdminPages";
import PortalAccess from "../components/PortalAccess";
import AppShell from "../components/AppShell";
import Overview from "../components/Overview";
import { Initials, StatusBadge } from "../components/ui/Brand";
import UsersPage from "./UsersPage";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Settings2,
  ShieldCheck,
  UsersRound,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { modules, type Field } from "../lib/modules";
import { buttonClass, inputClass } from "./AuthPage";
import {
  fetchOrganizationRecords,
  openPrivateAttachment,
  uploadPrivateAttachment,
  type RecordRow,
} from "../lib/records";
function failure(e: unknown) {
  return e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "Não foi possível concluir a operação.";
}
export default function WorkspacePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const parts = location.pathname.split("/").filter(Boolean);
  const base = parts[0] === "app" ? "/app" : `/${parts[0]}`;
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    () => localStorage.getItem("medsync-organization-id") || "",
  );
  const segment =
    parts[1] === "configuracoes" && parts[2] === "usuarios"
      ? "usuarios"
      : parts[1] || "dashboard";
  const moduleKey =
    segment === "agenda" ||
    segment === "fila-atendimento" ||
    segment === "atendimentos" ||
    segment === "agendar" ||
    segment === "historico"
      ? "consultas"
      : segment === "financeiro"
        ? parts[2] && modules[parts[2]]
          ? parts[2]
          : "pagamentos"
        : segment;
  const definition = modules[moduleKey];
  const idIndex =
    segment === "financeiro" && parts[2] && modules[parts[2]] ? 3 : 2;
  const rowId = parts[idIndex];
  const isNew =
    rowId === "novo" ||
    rowId === "nova" ||
    segment === "agendar" ||
    (segment === "unidades" && rowId === "nova");
  const editing = parts.includes("editar") || parts.includes("reagendar");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setSearch("");
    setStatusFilter("");
    setPage(1);
    setError("");
    setNotice("");
  }, [location.pathname]);
  const organization = useQuery({
    queryKey: ["organization", selectedOrganizationId],
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user)
        throw new Error("Sessão expirada. Entre novamente.");
      const { data: members, error } = await supabase
        .from("organization_members")
        .select("organization_id,role")
        .eq("user_id", auth.user.id);
      if (error) throw error;
      const { data: portalMemberships, error: portalError } = await supabase
        .from("medsync_memberships")
        .select("organization_id,role")
        .eq("user_id", auth.user.id);
      if (portalError && !["42P01", "PGRST205"].includes(portalError.code)) throw portalError;
      const conflictingRole = members?.some((member) =>
        portalMemberships?.some((portal) =>
          portal.organization_id === member.organization_id &&
          ["patient", "professional", "receptionist"].includes(String(portal.role)) &&
          String(portal.role) !== String(member.role),
        ),
      );
      if (conflictingRole) throw new Error(
        "Esta conta tem perfis conflitantes na clínica. O administrador precisa revisar organization_members e medsync_memberships antes de liberar o acesso.",
      );
      if (!members?.length) {
        const { data: invitedMembership, error: membershipError } =
          await supabase
            .from("medsync_memberships")
            .select("organization_id,role")
            .eq("user_id", auth.user.id)
            .order("organization_id");
        if (membershipError) {
          if (["42P01", "PGRST205"].includes(membershipError.code)) return null;
          throw membershipError;
        }
        if (!invitedMembership?.length) return null;
        const membership = invitedMembership.find(
          (entry) => entry.organization_id === selectedOrganizationId,
        ) || invitedMembership[0];
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("id,name")
          .eq("id", membership.organization_id)
          .single();
        if (orgError) throw orgError;
        return {
          id: String(org.id),
          name: String(org.name),
          role: String(membership.role),
          user: auth.user,
          organizations: await Promise.all(
            invitedMembership.map(async (entry) => {
              const { data: item, error: itemError } = await supabase
                .from("organizations")
                .select("id,name")
                .eq("id", entry.organization_id)
                .single();
              if (itemError) throw itemError;
              return {
                id: String(item.id),
                name: String(item.name),
                role: String(entry.role),
              };
            }),
          ),
        };
      }
      const member =
        members.find(
          (entry) => entry.organization_id === selectedOrganizationId,
        ) || members[0];
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id,name")
        .eq("id", member.organization_id)
        .single();
      if (orgError) throw orgError;
      return {
        id: String(org.id),
        name: String(org.name),
        role: String(member.role || ""),
        user: auth.user,
        organizations: await Promise.all(
          members.map(async (entry) => {
            const { data: item, error: itemError } = await supabase
              .from("organizations")
              .select("id,name")
              .eq("id", entry.organization_id)
              .single();
            if (itemError) throw itemError;
            return {
              id: String(item.id),
              name: String(item.name),
              role: String(entry.role || ""),
            };
          }),
        ),
      };
    },
  });
  const orgId = organization.data?.id;
  const records = useQuery({
    queryKey: ["records", orgId],
    enabled:
      !!orgId &&
      ["owner", "admin", "administrator", "super_admin"].includes(
        organization.data?.role.toLowerCase() || "",
      ),
    queryFn: () => fetchOrganizationRecords(orgId!),
  });
  const units = useQuery({
    queryKey: ["units", orgId],
    enabled:
      !!orgId &&
      ["owner", "admin", "administrator", "super_admin"].includes(
        organization.data?.role.toLowerCase() || "",
      ),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_units")
        .select("id,name")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data;
    },
  });
  const rows: RecordRow[] =
    moduleKey === "unidades"
      ? (units.data || []).map((u) => ({
          id: String(u.id),
          organization_id: orgId || "",
          module: "unidades",
          payload: { name: String(u.name) },
          created_at: "",
        }))
      : (records.data || []).filter((r) => r.module === moduleKey);
  const selected = rows.find((r) => r.id === rowId);
  const visible = rows
    .filter((r) =>
      JSON.stringify(r.payload)
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
    )
    .filter((r) => !statusFilter || r.payload.status === statusFilter)
    .filter(
      (r) =>
        segment !== "fila-atendimento" ||
        ["Em espera", "Em atendimento"].includes(r.payload.status),
    );
  function label(row: RecordRow) {
    return (
      row.payload.name ||
      reference(row.payload.patient_id) ||
      row.payload.starts_at ||
      row.id
    );
  }
  function reference(id?: string) {
    return records.data?.find((r) => r.id === id)?.payload.name || "";
  }
  function value(key: string, v: string) {
    return key.endsWith("_id")
      ? reference(v) || v
      : key === "amount"
        ? Number(v || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })
        : key === "starts_at" || key === "ends_at"
          ? new Date(v).toLocaleString("pt-BR")
          : v;
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !orgId) return;
    const formData = new FormData(event.currentTarget);
    const fileValue = formData.get("attachment");
    const attachment =
      fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    const payload = Object.fromEntries(
      [...formData.entries()]
        .filter(([key]) => key !== "attachment")
        .map(([key, value]) => [key, String(value)]),
    ) as Record<string, string>;
    if (selected?.payload.storage_path) {
      payload.storage_path = selected.payload.storage_path;
      payload.attachment_name = selected.payload.attachment_name || "";
      payload.attachment_type = selected.payload.attachment_type || "";
    }
    setBusy(true);
    setError("");
    try {
      if (
        payload.ends_at &&
        payload.starts_at &&
        payload.ends_at <= payload.starts_at
      )
        throw new Error("O fim precisa ser posterior ao início.");
      if (payload.amount && Number(payload.amount) < 0)
        throw new Error("O valor não pode ser negativo.");
      if (moduleKey === "consultas" && payload.status !== "Cancelada") {
        const startsAt = new Date(payload.starts_at).getTime();
        const service = records.data?.find(
          (r) => r.id === payload.service_id && r.module === "servicos",
        );
        const duration = Number(
          service?.payload.duration || payload.duration_minutes || 30,
        );
        if (!Number.isFinite(startsAt) || !Number.isFinite(duration))
          throw new Error("Informe uma data e duração válidas para a consulta.");
        const conflict = rows.some(
          (r) => {
            if (
              r.id === selected?.id ||
              r.payload.status === "Cancelada" ||
              r.payload.professional_id !== payload.professional_id
            )
              return false;
            const existingStart = new Date(r.payload.starts_at).getTime();
            const existingDuration = Number(
              r.payload.duration_minutes || 30,
            );
            if (!Number.isFinite(existingStart)) return false;
            return (
              startsAt < existingStart + (existingDuration + 10) * 60_000 &&
              startsAt + (duration + 10) * 60_000 > existingStart
            );
          },
        );
        if (conflict)
          throw new Error(
            "Este profissional já possui uma consulta nesse intervalo ou no intervalo de descanso.",
          );
      }
      const query =
        moduleKey === "unidades"
          ? selected
            ? supabase
                .from("clinic_units")
                .update({ name: payload.name })
                .eq("id", selected.id)
                .eq("organization_id", orgId)
                .select("id")
                .single()
            : supabase
                .from("clinic_units")
                .insert({ organization_id: orgId, name: payload.name })
                .select("id")
                .single()
          : selected
            ? supabase
                .from("medsync_records")
                .update({ payload })
                .eq("id", selected.id)
                .eq("organization_id", orgId)
                .select("id")
                .single()
            : supabase
                .from("medsync_records")
                .insert({ organization_id: orgId, module: moduleKey, payload })
                .select("id")
                .single();
      const { data, error } = await query;
      if (error) throw error;
      if (attachment) {
        const path = await uploadPrivateAttachment(orgId, data.id, attachment);
        const updatedPayload = {
          ...payload,
          storage_path: path,
          attachment_name: attachment.name,
          attachment_type: attachment.type,
        };
        const { error: metadataError } = await supabase
          .from("medsync_records")
          .update({ payload: updatedPayload })
          .eq("id", data.id)
          .eq("organization_id", orgId);
        if (metadataError) {
          const { error: cleanupError } = await supabase.storage
            .from("medsync-private")
            .remove([path]);
          if (cleanupError)
            throw new Error(
              `${failure(metadataError)} O arquivo foi enviado, mas a limpeza falhou: ${failure(cleanupError)}`,
            );
          throw metadataError;
        }
      }
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["records", orgId] }),
        cache.invalidateQueries({ queryKey: ["units", orgId] }),
      ]);
      navigate(
        `${base}/${segment === "agendar" ? "consultas" : segment}/${data.id}`,
      );
      setNotice("Registro salvo com sucesso.");
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  function field(field: Field) {
    const common = {
      name: field.key,
      required: field.required,
      defaultValue: selected?.payload[field.key] || "",
      className: inputClass,
    };
    const options =
      field.type === "patient" ||
      field.type === "professional" ||
      field.type === "service"
        ? (records.data || [])
            .filter(
              (r) =>
                r.module ===
                (field.type === "patient"
                  ? "pacientes"
                  : field.type === "professional"
                    ? "profissionais"
                    : "servicos") &&
                (field.type !== "service" ||
                  r.payload.status !== "Inativo"),
            )
            .map((r) => ({ value: r.id, label: label(r) }))
        : field.options?.map((s) => ({ value: s, label: s }));
    return (
      <label key={field.key} className="field-label">
        {field.label}
        {field.required && " *"}
        <div className="mt-2">
          {options ? (
            <select {...common}>
              <option value="">Selecione</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea {...common} rows={5} maxLength={20000} />
          ) : (
            <input
              {...(field.type === "file"
                ? { name: field.key, className: inputClass }
                : common)}
              type={field.type || "text"}
              accept={
                field.type === "file"
                  ? "application/pdf,image/jpeg,image/png"
                  : undefined
              }
              min={field.type === "number" ? 0 : undefined}
              step={field.type === "number" ? "0.01" : undefined}
              maxLength={500}
            />
          )}
        </div>
      </label>
    );
  }
  if (organization.isPending)
    return (
      <div className="app-loading" role="status">
        <span className="loading-mark" />
        Preparando seu workspace...
      </div>
    );
  if (organization.error) return (
    <main className="app-loading">
      <h1>Não foi possível liberar o acesso</h1>
      <p role="alert">{failure(organization.error)}</p>
      <button className="button button-primary" onClick={async () => {
        await supabase.auth.signOut();
        cache.clear();
        navigate("/login");
      }}>Sair da conta</button>
    </main>
  );
  if (!organization.data)
    return <NavigateToOnboarding />;
  if (
    organization.data &&
    ["patient", "professional", "receptionist"].includes(organization.data.role)
  ) {
    const target =
      organization.data.role === "patient"
        ? "/paciente"
        : organization.data.role === "professional"
          ? "/profissional"
          : "/recepcao";
    if (!location.pathname.startsWith(target + "/"))
      return <Navigate to={target + "/dashboard"} replace />;
    return <PortalPage organization={organization.data} />;
  }
  if (
    organization.data &&
    !["owner", "admin", "administrator", "super_admin"].includes(
      organization.data.role.toLowerCase(),
    )
  )
    return (
      <main className="app-loading">
        <h1>Acesso não reconhecido</h1>
        <p>Solicite à clínica a revisão do seu perfil de acesso.</p>
        <button
          className="button button-primary"
          onClick={async () => {
            await supabase.auth.signOut();
            cache.clear();
            navigate("/login");
          }}
        >
          Sair da conta
        </button>
      </main>
    );

  const profile = segment === "perfil";
  const reports =
    segment === "relatorios" ||
    (segment === "financeiro" && parts[2] === "fluxo-caixa");
  const home = segment === "dashboard" || !parts[1];
  const heading =
    extraPageTitles[segment] ||
    (home
      ? "Visão geral"
      : profile
        ? "Meu perfil"
        : reports
          ? "Relatórios"
          : segment === "usuarios"
            ? "Usuários"
            : segment === "configuracoes"
              ? "Configurações"
              : segment === "fila-atendimento"
                ? "Fila de atendimento"
                : segment === "agenda"
                  ? "Agenda"
                  : definition?.title || "Página não encontrada");
  const noun: Record<string, string> = {
    pacientes: "paciente",
    profissionais: "profissional",
    unidades: "unidade",
    consultas: "consulta",
    servicos: "serviço",
    convenios: "convênio",
    especialidades: "especialidade",
  };
  const newLabel = noun[moduleKey]
    ? `Nov${["unidades", "consultas", "especialidades"].includes(moduleKey) ? "a" : "o"} ${noun[moduleKey]}`
    : "Novo registro";
  const title = isNew
    ? newLabel
    : editing
      ? "Editar " + (noun[moduleKey] || "registro")
      : heading;
  const description = home
    ? "Um olhar sobre o seu dia. Mais clareza para cada decisão."
    : segment === "usuarios"
      ? "Conecte sua equipe e organize os acessos à clínica."
      : segment === "configuracoes"
        ? "O seu espaço de trabalho, do seu jeito."
        : profile
          ? "Suas informações e preferências de acesso."
          : reports
            ? "Acompanhe os valores registrados pela sua clínica."
            : definition?.description || "Organize sua rotina de atendimento.";
  const fetching =
    moduleKey === "unidades" ? units.isPending : records.isPending;
  const fetchError = moduleKey === "unidades" ? units.error : records.error;
  const pageCount = Math.max(1, Math.ceil(visible.length / 10));
  const currentPage = Math.min(page, pageCount);
  const shown = visible.slice((currentPage - 1) * 10, currentPage * 10);
  const userName = String(
    organization.data?.user.user_metadata.full_name ||
      organization.data?.user.email?.split("@")[0] ||
      "Administrador",
  );
  const listPath = `${base}/${segment}`;
  function switchOrganization(id: string) {
    localStorage.setItem("medsync-organization-id", id);
    setSelectedOrganizationId(id);
    const nextRole = organization.data?.organizations.find(
      (item) => item.id === id,
    )?.role.toLowerCase();
    if (nextRole === "patient") navigate("/paciente/dashboard");
    else if (nextRole === "professional") navigate("/profissional/dashboard");
    else if (nextRole === "receptionist") navigate("/recepcao/dashboard");
    else navigate("/app/dashboard");
  }
  return (
    <AppShell
      base={base}
      segment={segment}
      clinic={organization.data?.name || "Minha clínica"}
      organizations={organization.data?.organizations}
      activeOrganizationId={orgId}
      onOrganizationChange={switchOrganization}
      userName={userName}
      email={organization.data?.user.email || ""}
      heading={title}
      description={description}
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
        home ? (
          <Link className="button button-primary" to={`${base}/consultas/nova`}>
            <Plus size={16} />
            Agendar consulta
          </Link>
        ) : definition && !reports && !isNew && !editing && !rowId ? (
          <Link className="button button-primary" to={`${listPath}/novo`}>
            <Plus size={16} />
            {newLabel}
          </Link>
        ) : undefined
      }
    >
      {[
        organization.error,
        ...(segment === "usuarios" ? [] : [records.error, units.error]),
      ]
        .filter(Boolean)
        .map((e, i) => (
          <div key={i} role="alert" className="feedback feedback-error">
            Não foi possível carregar todos os dados.
            <button
              onClick={() => {
                void organization.refetch();
                void records.refetch();
                void units.refetch();
              }}
            >
              Tentar novamente
            </button>
            <details>
              <summary>Ver detalhes</summary>
              {failure(e)}
            </details>
          </div>
        ))}
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
      {segment === "usuarios" && orgId && (
        <>
          <UsersPage organizationId={orgId} />
          <PortalAccess organizationId={orgId} records={records.data || []} />
        </>
      )}
      {extraPageTitles[segment] && organization.data && (
        <AdminPages
          page={segment}
          records={records.data || []}
          units={units.data || []}
          clinic={organization.data.name}
          user={organization.data.user}
          base={base}
          ready={records.isSuccess}
          organizationId={organization.data.id}
        />
      )}
      {home && (
        <Overview
          base={base}
          records={records.data || []}
          loading={records.isPending}
          failed={!!records.error}
        />
      )}
      {profile && (
        <form
          key="profile"
          className="surface profile-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            setNotice("");
            try {
              const { error } = await supabase.auth.updateUser({
                data: {
                  full_name: String(new FormData(e.currentTarget).get("name")),
                },
              });
              if (error) throw error;
              await cache.invalidateQueries({ queryKey: ["organization"] });
              setNotice("Perfil atualizado com sucesso.");
            } catch (e) {
              setError(failure(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="profile-form-head">
            <Initials name={userName} />
            <div>
              <h2>Informações pessoais</h2>
              <p>Mantenha seus dados atualizados.</p>
            </div>
          </div>
          <label className="field-label">
            Nome completo
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={userName}
              className={inputClass + " mt-2"}
            />
          </label>
          <label className="field-label mt-6">
            E-mail de acesso
            <input
              readOnly
              value={organization.data?.user.email || ""}
              className={inputClass + " mt-2"}
            />
            <small className="field-help">
              Seu e-mail identifica a conta usada para acessar a clínica.
            </small>
          </label>
          <div className="form-actions">
            <Link to="/recuperar-senha" className="button button-secondary">
              Alterar senha
            </Link>
            <button disabled={busy} className={buttonClass}>
              {busy ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      )}
      {segment === "configuracoes" && (
        <div className="settings-grid">
          {[
            {
              icon: Building2,
              title: "Sua organização",
              description:
                organization.data?.name ||
                "Gerencie os locais de atendimento da sua clínica.",
              link: "unidades",
              action: "Gerenciar unidades",
            },
            {
              icon: UsersRound,
              title: "Pessoas e acessos",
              description:
                "Convide novos usuários e acompanhe os convites da sua clínica.",
              link: "usuarios",
              action: "Gerenciar usuários",
            },
            {
              icon: Settings2,
              title: "Conta e segurança",
              description:
                "Atualize seu nome e gerencie a senha de acesso ao sistema.",
              link: "seguranca",
              action: "Gerenciar segurança",
            },
          ].map((item) => (
            <section key={item.title} className="surface settings-card">
              <item.icon size={24} />
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <Link to={`${base}/${item.link}`} className="text-link">
                {item.action}
                <ArrowRight size={15} />
              </Link>
            </section>
          ))}
        </div>
      )}
      {reports && (
        <>
          <div className="metric-grid">
            {["pagamentos", "contas-receber", "contas-pagar"].map((key) => (
              <Link to={`${base}/${key}`} key={key} className="metric-card">
                <div className="metric-top">
                  {modules[key].title}
                  <ArrowUpRight size={17} />
                </div>
                <strong>
                  {records.isSuccess
                    ? records.data
                        .filter(
                          (r) =>
                            r.module === key &&
                            r.payload.status !== "Cancelado",
                        )
                        .reduce(
                          (sum, r) => sum + Number(r.payload.amount || 0),
                          0,
                        )
                        .toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })
                    : "—"}
                </strong>
                <small>Total dos registros carregados, exceto cancelados</small>
              </Link>
            ))}
          </div>
          <div className="surface collection-body">
            <ShieldCheck className="mb-4 text-teal-700" size={25} />
            <p className="text-sm leading-7 text-slate-500">
              Os valores refletem os lançamentos cadastrados na clínica. Abra
              uma categoria para consultar os detalhes dos pagamentos e
              vencimentos.
            </p>
          </div>
        </>
      )}
      {segment === "agenda" && !rowId && (
        <ScheduleCalendar
          records={records.data || []}
          base={base}
          ready={records.isSuccess}
        />
      )}
      {definition && !reports && !(segment === "agenda" && !rowId) && (
        <section className="surface">
          {isNew || editing ? (
            <div className="collection-body">
              <Link to={listPath} className="back-link">
                <ArrowLeft size={15} />
                Voltar para {definition.title.toLocaleLowerCase("pt-BR")}
              </Link>
              {editing && fetching ? (
                <p role="status">Carregando registro...</p>
              ) : editing && !selected ? (
                <p>Registro não encontrado ou sem permissão.</p>
              ) : (
                <form
                  key={location.pathname}
                  onSubmit={save}
                  className="record-form"
                >
                  <h2>
                    {editing
                      ? "Atualizar informações"
                      : "Informações do cadastro"}
                  </h2>
                  <div className="record-form-fields">
                    {definition.fields
                      .filter(
                        (f) => moduleKey !== "unidades" || f.key === "name",
                      )
                      .map(field)}
                  </div>
                  <div className="form-actions">
                    <Link className="button button-secondary" to={listPath}>
                      Cancelar
                    </Link>
                    <button
                      disabled={
                        busy ||
                        !(moduleKey === "unidades"
                          ? units.isSuccess
                          : records.isSuccess)
                      }
                      className={buttonClass}
                    >
                      {busy
                        ? "Salvando..."
                        : editing
                          ? "Salvar alterações"
                          : "Salvar cadastro"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : rowId ? (
            <div className="collection-body">
              {selected ? (
                <>
                  <Link to={listPath} className="back-link">
                    <ArrowLeft size={15} />
                    Voltar à lista
                  </Link>
                  <div className="person-cell">
                    <Initials name={label(selected)} />
                    <h2 className="text-lg font-semibold text-slate-700">
                      {label(selected)}
                    </h2>
                  </div>
                  <dl className="detail-list">
                    {definition.fields
                      .filter(
                        (f) => moduleKey !== "unidades" || f.key === "name",
                      )
                      .map((f) => (
                        <div key={f.key}>
                          <dt>{f.label}</dt>
                          <dd
                            className={
                              f.type === "textarea" ? "detail-long" : ""
                            }
                          >
                            {f.key === "status" ? (
                              <StatusBadge status={selected.payload[f.key]} />
                            ) : (
                              value(f.key, selected.payload[f.key]) ||
                              "Não informado"
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
                          setError(failure(e));
                        }
                      }}
                    >
                      Abrir arquivo privado
                    </button>
                  )}
                  <div className="form-actions">
                    <Link
                      to={`${listPath}/${selected.id}/editar`}
                      className={buttonClass}
                    >
                      Editar informações
                    </Link>
                  </div>
                </>
              ) : (
                <div className="empty-panel">
                  {fetching
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
                    aria-label="Buscar registros"
                    placeholder={`Buscar em ${definition.title.toLocaleLowerCase("pt-BR")}...`}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <div className="collection-info">
                  {definition.fields.some((f) => f.key === "status") && (
                    <select
                      aria-label="Filtrar por situação"
                      className="filter-select"
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">Todas as situações</option>
                      {definition.fields
                        .find((f) => f.key === "status")
                        ?.options?.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                    </select>
                  )}
                  <span>
                    {fetching || fetchError ? "—" : visible.length} registros
                  </span>
                </div>
              </div>
              {fetching ? (
                <div className="empty-panel" role="status">
                  Carregando registros...
                </div>
              ) : fetchError ? (
                <div className="empty-panel">
                  Não foi possível carregar os registros. Tente atualizar a
                  página.
                </div>
              ) : visible.length === 0 ? (
                <div className="empty-panel">
                  <span className="empty-icon">
                    <FolderOpen size={28} />
                  </span>
                  <h3>
                    {search || statusFilter
                      ? "Nenhum resultado encontrado"
                      : "Tudo pronto para o primeiro cadastro"}
                  </h3>
                  <p>
                    {search || statusFilter
                      ? "Experimente outro termo ou altere os filtros."
                      : "Comece a organizar as informações da sua clínica."}
                  </p>
                  {!search && !statusFilter && (
                    <Link
                      to={`${listPath}/novo`}
                      className="button button-secondary"
                    >
                      <Plus size={15} />
                      {newLabel}
                    </Link>
                  )}
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{noun[moduleKey] || "Registro"}</th>
                        {definition.fields
                          .filter(
                            (f) =>
                              !["name", "notes"].includes(f.key) &&
                              moduleKey !== "unidades",
                          )
                          .slice(0, 3)
                          .map((f) => (
                            <th key={f.key}>{f.label}</th>
                          ))}
                        <th>
                          <span className="sr-only">Ação</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className="person-cell">
                              <Initials name={label(row)} />
                              <strong>{label(row)}</strong>
                            </div>
                          </td>
                          {definition.fields
                            .filter(
                              (f) =>
                                !["name", "notes"].includes(f.key) &&
                                moduleKey !== "unidades",
                            )
                            .slice(0, 3)
                            .map((f) => (
                              <td key={f.key}>
                                {f.key === "status" ? (
                                  <StatusBadge status={row.payload[f.key]} />
                                ) : (
                                  value(f.key, row.payload[f.key]) || "—"
                                )}
                              </td>
                            ))}
                          <td>
                            <Link
                              className="table-arrow"
                              aria-label={`Abrir ${label(row)}`}
                              to={`${listPath}/${row.id}`}
                            >
                              <ArrowUpRight size={17} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="surface-bottom">
                <span>
                  {visible.length
                    ? `${(currentPage - 1) * 10 + 1}–${Math.min(currentPage * 10, visible.length)} de ${visible.length} registros`
                    : "Seus registros aparecerão aqui."}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    aria-label="Página anterior"
                    className="icon-button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>
                    {currentPage} / {pageCount}
                  </span>
                  <button
                    aria-label="Próxima página"
                    className="icon-button"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
      {!home &&
        !definition &&
        !profile &&
        !reports &&
        !["configuracoes", "usuarios"].includes(segment) &&
        !extraPageTitles[segment] && (
          <div className="surface empty-panel">
            <FolderOpen size={30} />
            <h2 className="mt-4">Página não encontrada</h2>
            <Link to={`${base}/dashboard`} className="text-link mt-4">
              Voltar ao painel <ArrowRight size={16} />
            </Link>
          </div>
        )}
    </AppShell>
  );
}
function NavigateToOnboarding() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/app/criar-clinica", { replace: true });
  }, [navigate]);
  return (
    <div className="app-loading" role="status">
      Preparando configuração inicial...
    </div>
  );
}
