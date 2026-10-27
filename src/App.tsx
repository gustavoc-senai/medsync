import { lazy, Suspense } from "react";
import { Route, Routes, Link, Navigate } from "react-router-dom";
const LandingPage = lazy(() => import("./pages/LandingPage"));
import AuthPage, { AuthGate } from "./pages/AuthPage";
const WorkspacePage = lazy(() => import("./pages/WorkspacePage"));
import CreateClinicPage from "./pages/CreateClinicPage";
import OrganizationGate from "./components/OrganizationGate";
export default function App() {
  return (
    <Suspense
      fallback={
        <div className="app-loading" role="status">
          <span className="loading-mark" />
          Carregando MedSync...
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {[
          "/login",
          "/cadastro",
          "/recuperar-senha",
          "/redefinir-senha",
          "/aceitar-convite",
        ].map((path) => (
          <Route key={path} path={path} element={<AuthPage />} />
        ))}
        <Route
          path="/onboarding/*"
          element={
            <AuthGate>
              <OrganizationGate requireClinic={false}>
                <CreateClinicPage />
              </OrganizationGate>
            </AuthGate>
          }
        />
        <Route
          path="/app/criar-clinica"
          element={
            <AuthGate>
              <OrganizationGate requireClinic={false}>
                <CreateClinicPage />
              </OrganizationGate>
            </AuthGate>
          }
        />
        <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
        <Route
          path="/app/*"
          element={
            <AuthGate>
              <WorkspacePage />
            </AuthGate>
          }
        />
        {["/paciente/*", "/profissional/*", "/recepcao/*"].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <AuthGate>
                <WorkspacePage />
              </AuthGate>
            }
          />
        ))}
        <Route
          path="/admin/*"
          element={
            <AuthGate>
              <WorkspacePage />
            </AuthGate>
          }
        />
        <Route
          path="*"
          element={
            <main className="app-loading">
              <h1 className="text-2xl font-semibold text-slate-700">
                Página não encontrada
              </h1>
              <Link className="button button-primary" to="/">
                Voltar ao início
              </Link>
            </main>
          }
        />
      </Routes>
    </Suspense>
  );
}
