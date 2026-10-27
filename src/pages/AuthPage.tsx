import { Brand } from "../components/ui/Brand";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  Check,
  Eye,
  EyeOff,
  HeartPulse,
  LockKeyhole,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export const inputClass = "form-input";
export const buttonClass = "button button-primary";
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "in" | "out">("loading");
  const location = useLocation();
  const cache = useQueryClient();
  const sessionUserId = useRef<string | null>(null);
  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        const userId = data.session?.user.id || null;
        if (sessionUserId.current !== userId) cache.clear();
        sessionUserId.current = userId;
        setState(data.session ? "in" : "out");
      });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user.id || null;
      if (event === "SIGNED_OUT" || sessionUserId.current !== userId) cache.clear();
      sessionUserId.current = userId;
      setState(session ? "in" : "out");
    });
    return () => data.subscription.unsubscribe();
  }, [cache]);
  if (state === "loading")
    return (
      <p className="p-10" role="status">
        Verificando sessão...
      </p>
    );
  return state === "in" ? (
    children
  ) : (
    <Navigate to="/login" state={{ from: location.pathname }} replace />
  );
}
export default function AuthPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const signup = pathname === "/cadastro";
  const recovery = pathname === "/recuperar-senha";
  const invitation = pathname === "/aceitar-convite";
  const reset = pathname === "/redefinir-senha" || invitation;
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invitationSession, setInvitationSession] = useState<"loading" | "ready" | "invalid">("loading");
  useEffect(() => {
    if (!invitation) return;
    let active = true;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (active) setInvitationSession(!error && data.user ? "ready" : "invalid");
    }).catch(() => {
      if (active) setInvitationSession("invalid");
    });
    return () => { active = false; };
  }, [invitation]);
  const title = signup
    ? "Comece pelo essencial."
    : recovery
      ? "Recuperar senha"
      : invitation
        ? "Você foi convidado para uma clínica"
      : reset
        ? "Defina sua senha"
        : "Bem-vindo ao MedSync";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (invitation && (invitationSession !== "ready" || form.get("acceptClinic") !== "on")) {
        throw new Error("Abra o link recebido por e-mail e confirme que deseja entrar na clínica.");
      }
      if (recovery) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/redefinir-senha`,
        });
        if (error) throw error;
        setMessage(
          "Se houver uma conta para este e-mail, você receberá o link de recuperação.",
        );
      } else if (reset) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        if (invitation) {
          const { error: acceptError } = await supabase.rpc(
            "medsync_accept_invitations",
          );
          if (acceptError)
            throw new Error(
              "Senha salva, mas não foi possível aceitar o vínculo com a clínica. Tente salvar novamente ou contate o administrador.",
            );
        }
        cache.clear();
        navigate("/app/dashboard", { replace: true });
      } else if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/onboarding`,
            data: { full_name: String(form.get("name")) },
          },
        });
        if (error) throw error;
        if (data.session) navigate("/onboarding", { replace: true });
        else
          setMessage("Confira seu e-mail para confirmar o cadastro e entrar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        cache.clear();
        navigate("/app/dashboard", { replace: true });
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand light />
        <div className="auth-story-content">
          <span className="auth-eyebrow">O CUIDADO COMEÇA NA ORGANIZAÇÃO</span>
          <h2>
            Mais clareza
            <br />
            na gestão.
            <br />
            <em>
              Mais tempo
              <br />
              para cuidar.
            </em>
          </h2>
          <p>
            Pacientes, equipe e rotina clínica.
            <br />
            Um espaço para conectar tudo isso.
          </p>
          <div className="auth-story-card">
            <div className="auth-card-icon">
              <CalendarCheck2 size={23} />
            </div>
            <div>
              <strong>Uma rotina mais leve.</strong>
              <span>Do primeiro cadastro ao próximo atendimento.</span>
            </div>
            <Check size={17} />
          </div>
        </div>
        <div className="auth-story-footer">
          <span>medsync · gestão clínica</span>
          <span>Feito para conectar.</span>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <Link to="/" className="auth-back">
          <ArrowLeft size={15} />
          Voltar ao início
        </Link>
        <div className="auth-form-wrap">
          <div className="auth-form-symbol">
            <HeartPulse size={25} />
          </div>
          <span className="auth-form-eyebrow">SEU WORKSPACE DE SAÚDE</span>
          <h1>{title}</h1>
          <p className="auth-form-description">
            {signup
              ? "O primeiro passo para uma clínica mais organizada."
              : recovery
                ? "Vamos enviar as instruções para você recuperar o acesso."
                : invitation
                  ? "Defina sua senha e confirme abaixo que deseja fazer parte da clínica que enviou este convite."
                : reset
                  ? "Crie uma senha para acessar seu espaço com tranquilidade."
                  : "Entre na sua conta para continuar de onde parou."}
          </p>
          {invitation && invitationSession === "loading" && (
            <p role="status">Verificando seu convite...</p>
          )}
          {invitation && invitationSession === "invalid" && (
            <p role="alert" className="feedback feedback-error">
              Este link de convite está inválido ou expirou. Abra o link recebido
              por e-mail ou peça ajuda ao administrador da clínica.
            </p>
          )}
          {(!invitation || invitationSession === "ready") && <form key={pathname} onSubmit={submit} className="auth-form">
            {signup && (
              <label className="field-label">
                Nome completo
                <input
                  name="name"
                  placeholder="Como podemos chamar você?"
                  required
                  maxLength={120}
                  autoComplete="name"
                  className={inputClass}
                />
              </label>
            )}
            {!reset && (
              <label className="field-label">
                E-mail
                <input
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  className={inputClass}
                />
              </label>
            )}
            {!recovery && (
              <label className="field-label">
                <span className="auth-password-label">
                  Senha
                  {!signup && !reset && (
                    <Link to="/recuperar-senha">Esqueci minha senha</Link>
                  )}
                </span>
                <div className="password-field">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha de acesso"
                    minLength={8}
                    required
                    autoComplete={
                      signup || reset ? "new-password" : "current-password"
                    }
                    className={inputClass}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {(signup || reset) && (
                  <small className="field-help">
                    Use pelo menos 8 caracteres.
                  </small>
                )}
              </label>
            )}
            {invitation && (
              <label className="invitation-confirmation">
                <input type="checkbox" name="acceptClinic" required disabled={busy} />
                <span>Confirmo que quero entrar na clínica que me enviou este convite.</span>
              </label>
            )}
            {error && (
              <p role="alert" className="feedback feedback-error">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="feedback feedback-success">
                {message}
              </p>
            )}
            <button
              disabled={busy}
              className={`${buttonClass} button-lg w-full`}
            >
              {busy
                ? "Aguarde..."
                : recovery
                  ? "Enviar link de recuperação"
                  : invitation
                    ? "Aceitar convite e entrar na clínica"
                  : reset
                    ? "Salvar senha"
                    : signup
                      ? "Criar minha conta"
                      : "Entrar no workspace"}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>}
          <p className="auth-alternate">
            {signup
              ? "Já tem uma conta?"
              : invitation
                ? "Prefere decidir depois?"
              : recovery || reset
                ? "Lembrou sua senha?"
                : "Ainda não tem uma conta?"}{" "}
            <Link to={signup || recovery || reset ? "/login" : "/cadastro"}>
              {signup || recovery || reset ? "Entrar" : "Começar agora"}
            </Link>
          </p>
          <div className="auth-trust">
            <LockKeyhole size={13} />
            <span>Seu acesso é pessoal. Cuide bem dele.</span>
          </div>
        </div>
        <footer className="auth-footer">
          © {new Date().getFullYear()} MedSync · Gestão que aproxima.
        </footer>
      </main>
    </div>
  );
}
