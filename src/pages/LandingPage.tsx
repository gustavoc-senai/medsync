import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  FileHeart,
  HeartPulse,
  Menu,
  Stethoscope,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Brand } from "../components/ui/Brand";
const faq = [
  [
    "O que consigo organizar com o MedSync?",
    "Você pode cadastrar pacientes e profissionais, organizar consultas e disponibilidade, registrar informações clínicas e acompanhar lançamentos financeiros. Os módulos seguem em evolução.",
  ],
  [
    "Posso organizar mais de uma unidade?",
    "A organização possui um cadastro de unidades. Você pode registrar os locais da sua clínica e manter a estrutura de atendimento centralizada.",
  ],
  [
    "Como funciona o acesso da equipe?",
    "O administrador envia um convite por e-mail e define o perfil da pessoa. Cada convidado cria a própria senha. As áreas de paciente e profissional dependem dos vínculos e permissões configurados na clínica.",
  ],
  [
    "Como conhecer o sistema?",
    "Crie uma conta, confirme seu e-mail e configure a clínica. Você também pode entrar em uma conta existente pelo botão de acesso. O MedSync está em desenvolvimento; condições comerciais serão definidas no lançamento.",
  ],
];
export default function LandingPage() {
  const [open, setOpen] = useState(false);
  return (
    <div className="marketing-page">
      <header className="marketing-header">
        <div className="marketing-container">
          <Brand />
          <nav aria-label="Navegação do site">
            <a href="#plataforma">A plataforma</a>
            <a href="#rotina">Como funciona</a>
            <a href="#perguntas">Dúvidas frequentes</a>
          </nav>
          <div className="marketing-nav-actions">
            <Link to="/login">Entrar</Link>
            <Link to="/cadastro" className="button button-primary">
              Conhecer o MedSync <ArrowUpRight size={15} />
            </Link>
          </div>
          <button
            className="icon-button marketing-mobile-menu"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="marketing-mobile-links">
            <a href="#plataforma" onClick={() => setOpen(false)}>
              A plataforma
            </a>
            <a href="#rotina" onClick={() => setOpen(false)}>
              Como funciona
            </a>
            <a href="#perguntas" onClick={() => setOpen(false)}>
              Dúvidas frequentes
            </a>
            <Link to="/login">Entrar</Link>
            <Link to="/cadastro">Criar conta</Link>
          </div>
        )}
      </header>
      <main>
        <section className="marketing-hero marketing-container">
          <div className="hero-copy">
            <span className="marketing-eyebrow">
              <span /> GESTÃO CLÍNICA, COM MAIS CLAREZA
            </span>
            <h1>
              Sua clínica
              <br />
              em sintonia.
              <br />
              <em>
                Seu cuidado
                <br />
                em primeiro lugar.
              </em>
            </h1>
            <p>
              Menos tarefas espalhadas. Mais tempo para o que importa. Conecte
              pacientes, equipe e rotina em um único espaço de gestão.
            </p>
            <div className="hero-actions">
              <Link to="/cadastro" className="button button-primary button-lg">
                Começar agora <ArrowRight size={17} />
              </Link>
              <a
                href="#plataforma"
                className="button button-secondary button-lg"
              >
                Explorar a plataforma <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="hero-assurances">
              <span>
                <Check size={13} />
                Agenda e cadastros
              </span>
              <span>
                <Check size={13} />
                Gestão por organização
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-photo">
              <img
                src="/images/clinic-editorial.png"
                alt="Profissional de saúde e gestora organizando a rotina em uma clínica iluminada"
                fetchPriority="high"
              />
              <span className="photo-caption">
                Tecnologia a serviço de quem cuida.
              </span>
            </div>
            <div className="hero-floating-card">
              <span className="floating-icon">
                <CalendarDays size={23} />
              </span>
              <div>
                <small>UMA ROTINA MAIS CONECTADA</small>
                <strong>Cada atendimento, no seu lugar.</strong>
                <p>Agenda, equipe e pacientes em sintonia.</p>
              </div>
              <CheckCheck size={19} />
            </div>
            <div className="hero-side-note">
              <span />
              Gestão que acompanha você.
            </div>
          </div>
        </section>
        <div className="marketing-product-strip">
          <div className="marketing-container">
            <span>
              UMA PLATAFORMA.
              <br />
              <strong>Uma visão completa da rotina.</strong>
            </span>
            <p>
              <CalendarDays size={18} />
              Agenda
            </p>
            <p>
              <Users size={18} />
              Pacientes
            </p>
            <p>
              <Stethoscope size={18} />
              Equipe
            </p>
            <p>
              <FileHeart size={18} />
              Registros clínicos
            </p>
            <p>
              <Wallet size={18} />
              Financeiro
            </p>
          </div>
        </div>
        <section
          id="plataforma"
          className="marketing-platform marketing-container"
        >
          <div className="marketing-section-heading">
            <div>
              <span className="marketing-eyebrow">
                TUDO CONVERSA, TUDO FLUI
              </span>
              <h2>
                A gestão ganha clareza.
                <br />A sua rotina ganha espaço.
              </h2>
            </div>
            <p>
              Um workspace pensado para reunir as informações que a clínica usa
              todos os dias. Simples de encontrar. Mais fácil de acompanhar.
            </p>
          </div>
          <div className="platform-showcase">
            <div className="showcase-sidebar">
              <Brand />
              <span className="showcase-section-label">PRINCIPAL</span>
              {["Visão geral", "Agenda", "Pacientes", "Profissionais"].map(
                (s, i) => (
                  <div key={s} className={i === 0 ? "selected" : ""}>
                    <span className="showcase-nav-dot" />
                    {s}
                  </div>
                ),
              )}
              <span className="showcase-section-label">GESTÃO</span>
              <div>Atendimento</div>
              <div>Financeiro</div>
            </div>
            <div className="showcase-body">
              <div className="showcase-top">
                <span>Workspace / Visão geral</span>
                <span className="showcase-demo">PRÉVIA ILUSTRATIVA</span>
              </div>
              <div className="showcase-title">
                <div>
                  <h3>Um bom dia começa aqui.</h3>
                  <p>As informações que importam, à primeira vista.</p>
                </div>
                <CalendarDays size={24} />
              </div>
              <div className="showcase-metrics">
                {[
                  ["Consultas do dia", "12"],
                  ["Pacientes em espera", "03"],
                  ["Atendimentos concluídos", "08"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>Exemplo demonstrativo</small>
                  </div>
                ))}
              </div>
              <div className="showcase-agenda">
                <h4>Agenda organizada. Atendimento mais leve.</h4>
                {["08:30", "09:00", "09:30"].map((time, i) => (
                  <div key={time}>
                    <span>{time}</span>
                    <span className="showcase-avatar">
                      <Users size={14} />
                    </span>
                    <p>
                      Paciente demonstrativo {i + 1}
                      <small>Consulta · Unidade principal</small>
                    </p>
                    <span className="showcase-status">Confirmada</span>
                  </div>
                ))}
              </div>
              <small className="showcase-disclaimer">
                Dados fictícios para apresentação visual do produto.
              </small>
            </div>
          </div>
          <div className="platform-features">
            {[
              {
                icon: CalendarDays,
                title: "Uma agenda com contexto.",
                text: "Consulte horários, profissionais e situação dos atendimentos em uma rotina centralizada.",
              },
              {
                icon: Users,
                title: "Cada pessoa, bem organizada.",
                text: "Mantenha pacientes, profissionais e contatos acessíveis à sua gestão.",
              },
              {
                icon: Wallet,
                title: "Os números, mais claros.",
                text: "Registre pagamentos e acompanhe contas a pagar, recebíveis e valores lançados.",
              },
            ].map((item) => (
              <article key={item.title}>
                <span>
                  <item.icon size={22} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="rotina" className="marketing-workflow">
          <div className="marketing-container workflow-layout">
            <div>
              <span className="marketing-eyebrow">
                DO CADASTRO AO ATENDIMENTO
              </span>
              <h2>
                Organizar pode
                <br />
                ser mais simples.
              </h2>
              <p>
                Uma sequência clara para começar, conectar a equipe e cuidar da
                operação.
              </p>
              <Link to="/cadastro" className="button button-primary button-lg">
                Criar meu workspace <ArrowRight size={16} />
              </Link>
            </div>
            <ol>
              {[
                [
                  "Configure a sua clínica",
                  "Cadastre a organização e os locais de atendimento.",
                ],
                [
                  "Conecte as pessoas",
                  "Organize os profissionais e convide os usuários da clínica.",
                ],
                [
                  "Dê ritmo à sua rotina",
                  "Cadastre pacientes, agende consultas e acompanhe os registros.",
                ],
              ].map(([title, text], i) => (
                <li key={title}>
                  <span>0{i + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section id="perguntas" className="marketing-faq marketing-container">
          <div>
            <span className="marketing-eyebrow">ANTES DE COMEÇAR</span>
            <h2>
              Vamos esclarecer
              <br />
              as suas dúvidas.
            </h2>
            <p>Conheça melhor a proposta do MedSync.</p>
          </div>
          <div>
            {faq.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <ChevronDown size={16} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="marketing-container">
          <div className="marketing-cta">
            <div>
              <span>MAIS ORGANIZAÇÃO. MAIS POSSIBILIDADES.</span>
              <h2>
                O próximo passo da sua
                <br />
                clínica começa aqui.
              </h2>
              <p>Conheça um jeito mais conectado de gerir o atendimento.</p>
            </div>
            <Link to="/cadastro" className="button button-light button-lg">
              Conhecer o MedSync <ArrowUpRight size={18} />
            </Link>
            <HeartPulse
              className="cta-watermark"
              size={260}
              strokeWidth={0.5}
            />
          </div>
        </section>
      </main>
      <footer className="marketing-footer marketing-container">
        <div>
          <Brand />
          <p>Tecnologia que aproxima a gestão do cuidado.</p>
        </div>
        <div>
          <a href="#plataforma">A plataforma</a>
          <a href="#perguntas">Perguntas frequentes</a>
          <Link to="/login">
            Entrar no sistema <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="marketing-footer-bottom">
          <span>
            © {new Date().getFullYear()} MedSync. Todos os direitos reservados.
          </span>
          <span>Produto em desenvolvimento.</span>
        </div>
      </footer>
    </div>
  );
}
