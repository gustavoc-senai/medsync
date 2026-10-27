import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  CreditCard,
  FileHeart,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Brand, Initials } from "./ui/Brand";

type NavigationItem = { path: string; label: string; icon: LucideIcon };
const primary: NavigationItem[] = [
  { path: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { path: "agenda", label: "Agenda", icon: CalendarDays },
  { path: "pacientes", label: "Pacientes", icon: Users },
  { path: "profissionais", label: "Profissionais", icon: Stethoscope },
  { path: "fila-atendimento", label: "Fila de atendimento", icon: Clock3 },
];
const groups: { label: string; icon: LucideIcon; items: NavigationItem[] }[] = [
  {
    label: "Atendimento",
    icon: FileHeart,
    items: [
      { path: "consultas", label: "Consultas", icon: CalendarDays },
      { path: "disponibilidade", label: "Disponibilidade", icon: Clock3 },
      { path: "prontuario", label: "Prontuários", icon: FileHeart },
      { path: "receitas", label: "Receitas", icon: FileText },
      { path: "exames", label: "Exames", icon: Activity },
      { path: "atestados", label: "Atestados", icon: FileText },
      { path: "documentos", label: "Documentos", icon: FileText },
    ],
  },
  {
    label: "Financeiro",
    icon: Wallet,
    items: [
      { path: "pagamentos", label: "Pagamentos", icon: CreditCard },
      { path: "contas-receber", label: "Contas a receber", icon: Wallet },
      { path: "contas-pagar", label: "Contas a pagar", icon: Wallet },
      {
        path: "relatorios",
        label: "Visão financeira",
        icon: ChartNoAxesCombined,
      },
      {
        path: "relatorios-atendimentos",
        label: "Atendimentos",
        icon: ChartNoAxesCombined,
      },
      {
        path: "relatorios-financeiro",
        label: "Relatório financeiro",
        icon: ChartNoAxesCombined,
      },
      { path: "fluxo-caixa", label: "Fluxo de caixa", icon: Wallet },
    ],
  },
  {
    label: "Organização",
    icon: Building2,
    items: [
      { path: "unidades", label: "Unidades", icon: Building2 },
      { path: "especialidades", label: "Especialidades", icon: HeartPulse },
      { path: "servicos", label: "Serviços", icon: FileText },
      { path: "convenios", label: "Convênios", icon: ShieldCheck },
    ],
  },
];
const settings: NavigationItem[] = [
  { path: "usuarios", label: "Usuários e convites", icon: UsersRound },
  { path: "configuracoes", label: "Configurações", icon: Settings2 },
];
const allItems = [
  ...primary,
  ...groups.flatMap((g) => g.items),
  ...settings,
  { path: "perfil", label: "Meu perfil", icon: Users },
];

type Props = {
  children: ReactNode;
  base: string;
  segment: string;
  clinic: string;
  userName: string;
  email: string;
  heading: string;
  description: string;
  actions?: ReactNode;
  onLogout: () => Promise<void>;
  portalRole?: string;
  organizations?: { id: string; name: string; role: string }[];
  activeOrganizationId?: string;
  onOrganizationChange?: (organizationId: string) => void;
};
export default function AppShell({
  children,
  base,
  segment,
  clinic,
  userName,
  email,
  heading,
  description,
  actions,
  onLogout,
  portalRole,
  organizations,
  activeOrganizationId,
  onOrganizationChange,
}: Props) {
  const { pathname } = useLocation();
  const roleLabel =
    portalRole === "patient"
      ? "Paciente"
      : portalRole === "professional"
        ? "Profissional"
        : portalRole === "receptionist"
          ? "Recepção"
          : "Administrador";
  const roleItems: NavigationItem[] =
    portalRole === "patient"
      ? [
          { path: "dashboard", label: "Meu resumo", icon: LayoutDashboard },
          { path: "consultas", label: "Minhas consultas", icon: CalendarDays },
          { path: "agendar", label: "Solicitar consulta", icon: CalendarDays },
          { path: "historico", label: "Histórico", icon: Clock3 },
          { path: "receitas", label: "Receitas", icon: FileText },
          { path: "exames", label: "Exames", icon: Activity },
          { path: "atestados", label: "Atestados", icon: FileText },
          { path: "documentos", label: "Documentos", icon: FileText },
          { path: "pagamentos", label: "Meus pagamentos", icon: CreditCard },
        ]
      : portalRole === "professional"
        ? [
            { path: "dashboard", label: "Meu resumo", icon: LayoutDashboard },
            { path: "agenda", label: "Minha agenda", icon: CalendarDays },
            {
              path: "fila-atendimento",
              label: "Fila de atendimento",
              icon: Clock3,
            },
            { path: "pacientes", label: "Meus pacientes", icon: Users },
            { path: "disponibilidade", label: "Disponibilidade", icon: Clock3 },
            { path: "prontuario", label: "Prontuários", icon: FileHeart },
            { path: "receitas", label: "Receitas", icon: FileText },
            { path: "exames", label: "Exames", icon: Activity },
            { path: "atestados", label: "Atestados", icon: FileText },
            { path: "documentos", label: "Documentos", icon: FileText },
          ]
        : portalRole === "receptionist"
          ? [
              ...primary.filter((i) => i.path !== "profissionais"),
              { path: "consultas", label: "Consultas", icon: CalendarDays },
              { path: "pagamentos", label: "Pagamentos", icon: CreditCard },
            ]
          : primary;
  const searchItems = portalRole
    ? [
        ...roleItems,
        { path: "perfil", label: "Meu perfil", icon: Users },
        { path: "seguranca", label: "Segurança", icon: ShieldCheck },
      ]
    : [
        ...allItems,
        { path: "minha-clinica", label: "Minha clínica", icon: Building2 },
        { path: "seguranca", label: "Segurança da conta", icon: ShieldCheck },
        {
          path: "relatorios-atendimentos",
          label: "Relatório de atendimentos",
          icon: ChartNoAxesCombined,
        },
        {
          path: "relatorios-financeiro",
          label: "Relatório financeiro",
          icon: ChartNoAxesCombined,
        },
        { path: "fluxo-caixa", label: "Fluxo de caixa", icon: Wallet },
      ];

  const mobile = useRef<HTMLDialogElement>(null);
  const command = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    mobile.current?.close();
    command.current?.close();
  }, [pathname]);
  function openSearch() {
    setQuery("");
    command.current?.showModal();
    searchRef.current?.focus();
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  function navLink(item: NavigationItem) {
    const active =
      segment === item.path ||
      (item.path === "pagamentos" && segment === "financeiro");
    const Icon = item.icon;
    return (
      <NavLink
        to={`${base}/${item.path}`}
        key={item.path}
        aria-current={active ? "page" : undefined}
        className={`app-nav-link ${active ? "is-active" : ""}`}
      >
        <Icon size={18} strokeWidth={1.8} />
        <span>{item.label}</span>
        {active && <span className="nav-active-dot" />}
      </NavLink>
    );
  }
  function navigation() {
    return (
      <>
        <div className="sidebar-brand">
          <Brand />
          <span className="workspace-tag">WORKSPACE</span>
        </div>
        <div className="clinic-switcher">
          <span className="clinic-icon">
            <Building2 size={19} />
          </span>
          {organizations && organizations.length > 1 && onOrganizationChange ? (
            <label className="clinic-switcher-select">
              <span className="sr-only">Selecionar clínica</span>
              <select
                aria-label="Selecionar clínica"
                value={activeOrganizationId || organizations[0].id}
                onChange={(event) =>
                  onOrganizationChange(event.currentTarget.value)
                }
              >
                {organizations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <small>Clínica ativa</small>
            </label>
          ) : (
            <>
              <div>
                <strong title={clinic}>{clinic}</strong>
                <span>Gestão da clínica</span>
              </div>
              <Check size={14} className="text-teal-700" />
            </>
          )}
        </div>
        <nav className="sidebar-navigation" aria-label="Menu principal">
          <span className="nav-section-label">PRINCIPAL</span>
          {roleItems.map(navLink)}
          {!portalRole && (
            <>
              <span className="nav-section-label nav-section-spaced">
                GESTÃO
              </span>
              {groups.map((group) => (
                <details
                  key={`${group.label}-${segment}`}
                  className="nav-group"
                  open={
                    group.items.some((i) => i.path === segment) || undefined
                  }
                >
                  <summary>
                    <group.icon size={18} strokeWidth={1.8} />
                    <span>{group.label}</span>
                    <ChevronDown size={14} />
                  </summary>
                  <div className="nav-subitems">{group.items.map(navLink)}</div>
                </details>
              ))}
              <span className="nav-section-label nav-section-spaced">
                ADMINISTRAÇÃO
              </span>
              {settings.map(navLink)}
              {navLink({
                path: "minha-clinica",
                label: "Minha clínica",
                icon: Building2,
              })}
            </>
          )}
          {portalRole && (
            <>
              <span className="nav-section-label nav-section-spaced">
                MINHA CONTA
              </span>
              {navLink({ path: "perfil", label: "Meu perfil", icon: Users })}
              {navLink({
                path: "seguranca",
                label: "Segurança",
                icon: ShieldCheck,
              })}
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="workspace-note-icon">
              <Sparkles size={17} />
            </span>
            <div>
              <strong>Tudo conectado.</strong>
              <p>Mais tempo para cuidar.</p>
            </div>
          </div>
          <Link to={`${base}/perfil`} className="sidebar-account">
            <Initials name={userName} />
            <div>
              <strong>{userName}</strong>
              <span>{roleLabel}</span>
            </div>
            <ChevronsUpDown size={15} />
          </Link>
        </div>
      </>
    );
  }
  const results = searchItems
    .filter(
      (item, index, items) =>
        items.findIndex((i) => i.path === item.path) === index,
    )
    .filter((i) =>
      i.label
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
    );
  return (
    <div className="app-layout">
      <aside className="app-sidebar">{navigation()}</aside>
      <dialog ref={mobile} className="mobile-navigation">
        <button
          className="mobile-close icon-button"
          aria-label="Fechar navegação"
          onClick={() => mobile.current?.close()}
        >
          <X size={20} />
        </button>
        {navigation()}
      </dialog>
      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-location">
            <button
              className="icon-button mobile-menu-trigger"
              onClick={() => mobile.current?.showModal()}
              aria-label="Abrir navegação"
            >
              <Menu size={21} />
            </button>
            <span className="topbar-workspace">Workspace</span>
            <ChevronRight size={14} />
            <span>{heading}</span>
          </div>
          <div className="topbar-actions">
            <button className="command-trigger" onClick={openSearch}>
              <Search size={16} />
              <span>Ir para uma página...</span>
              <kbd>Ctrl K</kbd>
            </button>
            <div className="topbar-divider" />
            <details className="account-menu">
              <summary aria-label="Opções da conta">
                <Initials name={userName} />
                <ChevronDown size={13} />
              </summary>
              <div className="account-dropdown">
                <strong>{userName}</strong>
                <span>{email}</span>
                <Link to={`${base}/perfil`}>Meu perfil</Link>
                <button
                  disabled={loggingOut}
                  onClick={async () => {
                    setLoggingOut(true);
                    try {
                      await onLogout();
                    } finally {
                      setLoggingOut(false);
                    }
                  }}
                >
                  <LogOut size={15} />
                  {loggingOut ? "Saindo..." : "Sair da conta"}
                </button>
              </div>
            </details>
          </div>
        </header>
        <main id="conteudo" className="workspace-content">
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                <span />
                GESTÃO CLÍNICA
              </div>
              <h1>{heading}</h1>
              <p>{description}</p>
            </div>
            <div className="page-heading-actions">{actions}</div>
          </div>
          {children}
          <footer className="workspace-footer">
            <span>© {new Date().getFullYear()} MedSync</span>
            <span>Um cuidado melhor começa com uma gestão melhor.</span>
          </footer>
        </main>
      </div>
      <dialog ref={command} className="command-dialog">
        <div className="command-input">
          <Search size={20} />
          <input
            ref={searchRef}
            aria-label="Buscar página"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Qual página você procura?"
          />
          <button
            className="icon-button"
            aria-label="Fechar busca"
            onClick={() => command.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <div className="command-results">
          {results.length ? (
            results.map((item) => (
              <Link key={item.path} to={`${base}/${item.path}`}>
                <item.icon size={19} />
                <span>{item.label}</span>
                <ArrowUpRight size={15} />
              </Link>
            ))
          ) : (
            <p>Nenhuma página encontrada.</p>
          )}
        </div>
        <div className="command-footer">
          Navegação rápida <kbd>Esc para fechar</kbd>
        </div>
      </dialog>
    </div>
  );
}
