import { Brand } from "../components/ui/Brand";

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../lib/supabase";

export default function CreateClinicPage() {
  const navigate = useNavigate();

  const [clinicName, setClinicName] = useState("");
  const [unitName, setUnitName] = useState("Unidade Principal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");

    const name = clinicName.trim();
    const unit = unitName.trim();

    if (name.length < 2 || name.length > 120) {
      setError("O nome da clínica deve ter entre 2 e 120 caracteres.");
      return;
    }

    if (unit.length < 2 || unit.length > 120) {
      setError("O nome da unidade deve ter entre 2 e 120 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw new Error("Sua sessão expirou. Entre novamente.");
      }

      // Evita cadastro duplicado em situações comuns.
      const { data: memberships, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userData.user.id)
        .limit(1);

      if (membershipError) throw membershipError;

      if (memberships && memberships.length > 0) {
        navigate("/app/dashboard", { replace: true });
        return;
      }

      // Função SQL criada na primeira etapa do banco.
      const { data: organizationId, error: createError } = await supabase.rpc(
        "create_clinic",
        {
          p_name: name,
          p_unit_name: unit,
        },
      );

      if (createError) throw createError;

      if (!organizationId) {
        throw new Error("Não foi possível confirmar o cadastro da clínica.");
      }

      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível cadastrar a clínica.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <main className="onboarding-page">
      <header>
        <Brand />
        <button className="button button-secondary" onClick={handleLogout}>
          <LogOut size={14} />
          Sair da conta
        </button>
      </header>
      <div className="onboarding-layout">
        <aside>
          <span className="marketing-eyebrow">
            BEM-VINDO AO SEU PRÓXIMO PASSO
          </span>
          <h1>
            Uma clínica
            <br />
            mais conectada
            <br />
            <em>começa aqui.</em>
          </h1>
          <p>
            Algumas informações para preparar o seu workspace e organizar o
            primeiro atendimento.
          </p>
          <ol>
            <li className="done">
              <span>
                <CheckCircle2 size={17} />
              </span>
              <div>
                <strong>Conta conectada</strong>
                <small>Seu acesso já está pronto.</small>
              </div>
            </li>
            <li className="current">
              <span>02</span>
              <div>
                <strong>Configure sua clínica</strong>
                <small>Organização e primeira unidade.</small>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Entre no seu workspace</strong>
                <small>Cadastre a equipe e os pacientes.</small>
              </div>
            </li>
          </ol>
        </aside>
        <section className="surface onboarding-form">
          <div className="users-form-icon">
            <Building2 size={22} />
          </div>
          <h2>Vamos conhecer sua clínica.</h2>
          <p>Você poderá adicionar outras unidades depois.</p>
          <form onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="clinicName">
              Nome da organização
              <input
                id="clinicName"
                name="clinicName"
                value={clinicName}
                onChange={(event) => setClinicName(event.target.value)}
                placeholder="Ex.: Clínica Vida e Saúde"
                minLength={2}
                maxLength={120}
                required
                className="form-input"
              />
            </label>
            <label className="field-label" htmlFor="unitName">
              Primeira unidade
              <input
                id="unitName"
                name="unitName"
                value={unitName}
                onChange={(event) => setUnitName(event.target.value)}
                placeholder="Ex.: Unidade principal"
                minLength={2}
                maxLength={120}
                required
                className="form-input"
              />
            </label>
            {error && (
              <p role="alert" className="feedback feedback-error">
                {error}
              </p>
            )}
            <button
              disabled={loading}
              className="button button-primary button-lg w-full"
            >
              {loading ? "Preparando seu workspace..." : "Criar minha clínica"}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>
          <div className="users-form-note">
            <ShieldCheck size={15} />
            <span>
              Um espaço de trabalho para sua organização. Os dados são acessados
              conforme as permissões da clínica.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
