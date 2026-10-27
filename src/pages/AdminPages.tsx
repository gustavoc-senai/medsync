import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  ArrowRight,
  Building2,
  CheckCheck,
  Download,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ClinicalRecord } from "../components/Overview";
import { StatusBadge } from "../components/ui/Brand";
const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const extraPageTitles: Record<string, string> = {
  "minha-clinica": "Minha clínica",
  seguranca: "Segurança da conta",
  "relatorios-atendimentos": "Relatório de atendimentos",
  "relatorios-financeiro": "Relatório financeiro",
  "fluxo-caixa": "Fluxo de caixa",
};
export default function AdminPages({
  page,
  records,
  units,
  clinic,
  user,
  base,
  ready,
  organizationId,
}: {
  page: string;
  records: ClinicalRecord[];
  units: { id: string; name: string }[];
  clinic: string;
  user: User;
  base: string;
  ready: boolean;
  organizationId?: string;
}) {
  const cache = useQueryClient();
  const date = new Date();
  const [from, setFrom] = useState(
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`,
  );
  const [to, setTo] = useState(
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const plans = useQuery({
    queryKey: ["plans"],
    enabled: page === "minha-clinica",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("medsync_list_plans");
      if (error) throw error;
      return data;
    },
  });
  const subscription = useQuery({
    queryKey: ["subscription", organizationId],
    enabled: page === "minha-clinica" && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medsync_subscriptions")
        .select("plan_code,status,current_period_end,provider")
        .eq("organization_id", organizationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  async function requestPlan(code: string) {
    if (!organizationId || busy) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const { error } = await supabase.rpc("medsync_request_plan", {
        p_organization_id: organizationId,
        p_plan_code: code,
      });
      if (error) throw error;
      await cache.invalidateQueries({
        queryKey: ["subscription", organizationId],
      });
      setFeedback(
        "Plano selecionado. A assinatura ficará pendente até a ativação de um provedor de cobrança.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível selecionar o plano.",
      );
    } finally {
      setBusy(false);
    }
  }
  const range = records.filter((r) => {
    const d = (r.payload.starts_at || r.payload.date || r.created_at).slice(
      0,
      10,
    );
    return d >= from && d <= to;
  });
  const appointments = range.filter((r) => r.module === "consultas");
  const payments = range.filter((r) =>
    ["pagamentos", "contas-receber", "contas-pagar"].includes(r.module),
  );
  const cashFlowPayments = payments
    .filter(
      (r) => r.payload.status === "Pago" && r.module !== "contas-receber",
    )
    .sort((a, b) =>
      (b.payload.date || "").localeCompare(a.payload.date || ""),
    );
  const financialRows =
    page === "fluxo-caixa" ? cashFlowPayments : payments;
  const received = payments
    .filter((r) => r.module === "pagamentos" && r.payload.status === "Pago")
    .reduce((n, r) => n + Number(r.payload.amount || 0), 0);
  const outgoing = payments
    .filter((r) => r.module === "contas-pagar" && r.payload.status === "Pago")
    .reduce((n, r) => n + Number(r.payload.amount || 0), 0);
  const pending = payments
    .filter(
      (r) => r.module === "contas-receber" && r.payload.status === "Pendente",
    )
    .reduce((n, r) => n + Number(r.payload.amount || 0), 0);
  function exportCsv() {
    const rows =
      page === "relatorios-atendimentos"
        ? [
            ["Paciente", "Profissional", "Data", "Situação"],
            ...appointments.map((r) => [
              records.find((p) => p.id === r.payload.patient_id)?.payload
                .name || "",
              records.find((p) => p.id === r.payload.professional_id)?.payload
                .name || "",
              r.payload.starts_at,
              r.payload.status,
            ]),
          ]
        : [
            ["Descrição", "Categoria", "Data", "Valor", "Situação"],
            ...financialRows.map((r) => [
              r.payload.name,
              r.module,
              r.payload.date,
              r.payload.amount,
              r.payload.status,
            ]),
          ];
    const text =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map((v) => {
              let s = String(v || "");
              if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
              return '"' + s.replaceAll('"', '""') + '"';
            })
            .join(";"),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `medsync-${page}-${from}-${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setFeedback("");
    if (data.get("password") !== data.get("confirm")) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: String(data.get("password")),
      });
      if (error) throw error;
      setFeedback("Senha atualizada com sucesso.");
      form.reset();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível atualizar a senha.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (page === "minha-clinica")
    return (
      <>
        <div className="clinic-cover">
          <img
            src="/images/clinic-interior.png"
            alt="Ambiente clínico ilustrativo com luz natural e mobiliário acolhedor"
          />
          <div>
            <span>SEU ESPAÇO DE CUIDADO</span>
            <h2>{clinic}</h2>
            <p>Uma estrutura organizada para a próxima etapa do atendimento.</p>
          </div>
        </div>
        <div className="settings-grid mt-6">
          <section className="surface settings-card">
            <Building2 size={25} />
            <h2>Locais de atendimento</h2>
            <strong className="text-3xl font-semibold text-slate-600">
              {units.length}
            </strong>
            <p>Unidades registradas na organização.</p>
            <Link to={`${base}/unidades/novo`} className="text-link">
              <Plus size={14} />
              Cadastrar unidade
            </Link>
          </section>
          <section className="surface settings-card">
            <Users size={25} />
            <h2>Equipe da clínica</h2>
            <p>
              Cadastre profissionais, envie convites e vincule cada conta ao seu
              cadastro.
            </p>
            <Link to={`${base}/usuarios`} className="text-link">
              Gerenciar pessoas <ArrowRight size={14} />
            </Link>
          </section>
          <section className="surface settings-card">
            <ShieldCheck size={25} />
            <h2>Conta administrativa</h2>
            <p>{user.email}</p>
            <Link to={`${base}/seguranca`} className="text-link">
              Revisar segurança <ArrowRight size={14} />
            </Link>
          </section>
        </div>
        <section className="surface mt-6">
          <div className="surface-header">
            <div>
              <h2>Planos e assinatura</h2>
              <p>
                Selecione a estrutura adequada. A cobrança recorrente será
                ativada quando o provedor for configurado.
              </p>
            </div>
            <StatusBadge status={subscription.data?.status || "Sem plano"} />
          </div>
          {error && (
            <p role="alert" className="feedback feedback-error mx-5">
              {error}
            </p>
          )}
          {feedback && (
            <p role="status" className="feedback feedback-success mx-5">
              {feedback}
            </p>
          )}
          {plans.error || subscription.error ? (
            <p role="alert" className="feedback feedback-warning mx-5">
              Não foi possível carregar os planos. Aplique a migração comercial
              para habilitar esta área.
            </p>
          ) : plans.isPending || subscription.isPending ? (
            <div className="empty-panel">Carregando planos...</div>
          ) : (
            <div className="settings-grid p-5">
              {(plans.data || []).map((plan) => (
                <article className="surface settings-card" key={plan.code}>
                  <h3>{plan.name}</h3>
                  <strong className="text-2xl font-semibold text-slate-700">
                    {money(plan.monthly_price_cents / 100)}
                    <small className="text-xs font-normal"> / mês</small>
                  </strong>
                  <p>
                    Até {plan.max_professionals} profissionais, {plan.max_units}{" "}
                    unidades e {plan.max_users} usuários.
                  </p>
                  <button
                    type="button"
                    className={
                      subscription.data?.plan_code === plan.code
                        ? "button button-secondary"
                        : "button button-primary"
                    }
                    disabled={
                      busy || subscription.data?.plan_code === plan.code
                    }
                    onClick={() => void requestPlan(plan.code)}
                  >
                    {subscription.data?.plan_code === plan.code
                      ? "Plano selecionado"
                      : busy
                        ? "Salvando..."
                        : "Selecionar plano"}
                  </button>
                </article>
              ))}
            </div>
          )}
          <p className="field-help px-5 pb-5">
            A seleção não inicia cobrança. Provedor, checkout, notas fiscais e
            regras de inadimplência dependem da configuração comercial.
          </p>
        </section>
        <section className="surface mt-6">
          <div className="surface-header">
            <div>
              <h2>Suas unidades</h2>
              <p>A estrutura de atendimento da sua organização.</p>
            </div>
            <Link to={`${base}/unidades`} className="text-link">
              Ver cadastro <ArrowRight size={14} />
            </Link>
          </div>
          {units.length ? (
            units.map((u) => (
              <div key={u.id} className="clinic-unit">
                <span className="clinic-icon">
                  <Building2 size={19} />
                </span>
                <strong>{u.name}</strong>
                <Link
                  to={`${base}/unidades/${u.id}/editar`}
                  className="text-link"
                >
                  Editar unidade
                </Link>
              </div>
            ))
          ) : (
            <div className="empty-panel">Nenhuma unidade disponível.</div>
          )}
        </section>
      </>
    );
  if (page === "seguranca")
    return (
      <div className="security-layout">
        <section className="surface collection-body">
          <div className="users-form-icon">
            <LockKeyhole size={22} />
          </div>
          <h2 className="text-base font-semibold text-slate-700">
            Atualizar senha
          </h2>
          <p className="field-help mb-6">
            Use uma senha pessoal com pelo menos 8 caracteres.
          </p>
          <form className="space-y-5" onSubmit={password}>
            <label className="field-label">
              Nova senha
              <input
                className="form-input"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <label className="field-label">
              Confirmar senha
              <input
                className="form-input"
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            {error && (
              <p role="alert" className="feedback feedback-error">
                {error}
              </p>
            )}
            {feedback && (
              <p role="status" className="feedback feedback-success">
                {feedback}
              </p>
            )}
            <button disabled={busy} className="button button-primary">
              {busy ? "Atualizando..." : "Salvar nova senha"}
            </button>
          </form>
        </section>
        <div className="space-y-5">
          <section className="surface collection-body">
            <h2 className="text-sm font-semibold text-slate-700">
              Informações do acesso
            </h2>
            <dl className="detail-list">
              <div>
                <dt>E-mail</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Verificação do e-mail</dt>
                <dd>
                  <StatusBadge
                    status={user.email_confirmed_at ? "Confirmada" : "Pendente"}
                  />
                </dd>
              </div>
              <div>
                <dt>Último acesso</dt>
                <dd>
                  {user.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleString("pt-BR")
                    : "Não disponível"}
                </dd>
              </div>
              <div>
                <dt>Conta criada</dt>
                <dd>{new Date(user.created_at).toLocaleDateString("pt-BR")}</dd>
              </div>
            </dl>
          </section>
          <section className="surface collection-body">
            <CheckCheck className="text-teal-700 mb-4" size={25} />
            <h2 className="text-sm font-semibold text-slate-700">
              Outros acessos
            </h2>
            <p className="field-help my-4">
              Encerre as sessões de outros dispositivos. Tokens já emitidos
              permanecem válidos até expirar.
            </p>
            <button
              disabled={busy}
              className="button button-secondary"
              onClick={async () => {
                setBusy(true);
                setError("");
                setFeedback("");
                try {
                  const { error } = await supabase.auth.signOut({
                    scope: "others",
                  });
                  if (error) throw error;
                  setFeedback("As outras sessões foram encerradas.");
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Não foi possível encerrar as sessões.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Encerrar outras sessões
            </button>
          </section>
        </div>
      </div>
    );
  const statuses = [
    "Agendada",
    "Confirmada",
    "Em espera",
    "Em atendimento",
    "Concluída",
    "Cancelada",
  ];
  return (
    <>
      <div className="report-toolbar surface">
        <div>
          <label className="field-label">
            De
            <input
              type="date"
              className="form-input"
              required
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field-label">
            Até
            <input
              type="date"
              className="form-input"
              required
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <button
          className="button button-secondary"
          disabled={!ready || !from || !to || from > to}
          onClick={exportCsv}
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>
      {!from || !to || from > to ? (
        <p className="feedback feedback-warning">
          Selecione um período válido.
        </p>
      ) : (
        <>
          {page === "relatorios-atendimentos" ? (
            <>
              <div className="metric-grid">
                {[
                  {
                    label: "Consultas registradas",
                    value: appointments.length,
                  },
                  {
                    label: "Atendimentos concluídos",
                    value: appointments.filter(
                      (r) => r.payload.status === "Concluída",
                    ).length,
                  },
                  {
                    label: "Cancelamentos",
                    value: appointments.filter(
                      (r) => r.payload.status === "Cancelada",
                    ).length,
                  },
                  {
                    label: "Profissionais com agenda",
                    value: new Set(
                      appointments.map((r) => r.payload.professional_id),
                    ).size,
                  },
                ].map((m) => (
                  <div className="metric-card" key={m.label}>
                    <div className="metric-top">{m.label}</div>
                    <strong>{ready ? m.value : "—"}</strong>
                    <small>No período selecionado</small>
                  </div>
                ))}
              </div>
              <section className="surface">
                <div className="surface-header">
                  <div>
                    <h2>Situação dos atendimentos</h2>
                    <p>Distribuição das consultas no período.</p>
                  </div>
                </div>
                <div className="report-bars">
                  {statuses.map((status) => {
                    const total = appointments.filter(
                      (r) => r.payload.status === status,
                    ).length;
                    return (
                      <div key={status}>
                        <span>{status}</span>
                        <div>
                          <i
                            style={{
                              width: ready
                                ? `${appointments.length ? (total / appointments.length) * 100 : 0}%`
                                : "0%",
                            }}
                          />
                        </div>
                        <strong>{ready ? total : "—"}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            <>
              <div className="metric-grid">
                {[
                  { label: "Recebimentos confirmados", value: received },
                  { label: "Despesas pagas", value: outgoing },
                  {
                    label: "Saldo dos lançamentos",
                    value: received - outgoing,
                  },
                  { label: "Contas a receber pendentes", value: pending },
                ].map((m) => (
                  <div className="metric-card" key={m.label}>
                    <div className="metric-top">{m.label}</div>
                    <strong>{ready ? money(m.value) : "—"}</strong>
                    <small>No período selecionado</small>
                  </div>
                ))}
              </div>
              <section className="surface">
                <div className="surface-header">
                  <div>
                    <h2>
                      {page === "fluxo-caixa"
                        ? "Entradas e saídas registradas"
                        : "Lançamentos financeiros"}
                    </h2>
                    <p>
                      Valores por data do lançamento. O saldo não representa um
                      extrato bancário.
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Descrição</th>
                        <th>Categoria</th>
                        <th>Data</th>
                        <th>Valor</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financialRows.map((r) => (
                          <tr key={r.id}>
                            <td>{r.payload.name || "Lançamento"}</td>
                            <td>
                              {r.module === "contas-pagar"
                                ? "Despesa"
                                : r.module === "contas-receber"
                                  ? "Conta a receber"
                                  : "Recebimento"}
                            </td>
                            <td>{r.payload.date || "—"}</td>
                            <td>{money(Number(r.payload.amount || 0))}</td>
                            <td>
                              <StatusBadge status={r.payload.status} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!financialRows.length && (
                  <div className="empty-panel">
                    {ready
                      ? "Nenhum lançamento no período."
                      : "Aguardando dados dos lançamentos..."}
                  </div>
                )}
              </section>
              <p className="field-help mt-4">
                Recebimentos somam pagamentos com situação Pago. Despesas somam
                contas a pagar com situação Pago. Contas a receber ficam
                separadas para evitar duplicidade.
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
