import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { I18nProvider, useI18n } from "./i18n/I18nProvider";
import { AuthProvider, useAuth } from "./lib/auth";
import { AdminAudit } from "./pages/AdminAudit";
import { AnomalyAlerts } from "./pages/AnomalyAlerts";
import { ForecastDetail } from "./pages/ForecastDetail";
import { Login } from "./pages/Login";
import { NationalOverview } from "./pages/NationalOverview";
import { PolicyBriefGenerator } from "./pages/PolicyBriefGenerator";
import { RegionalDrilldown } from "./pages/RegionalDrilldown";

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { t } = useI18n();

  if (status === "loading") {
    return (
      <div className="app-loading">
        <p className="mono-label">{t("common.loading")}</p>
      </div>
    );
  }
  if (status === "anonymous") {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: string; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthenticatedApp() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<NationalOverview />} />
        <Route path="/regions" element={<RegionalDrilldown />} />
        <Route path="/regions/:regionId" element={<RegionalDrilldown />} />
        <Route path="/anomalies" element={<AnomalyAlerts />} />
        <Route path="/forecast" element={<ForecastDetail />} />
        <Route path="/policy-brief" element={<PolicyBriefGenerator />} />
        <Route
          path="/admin"
          element={
            <RequireRole role="ministry_admin">
              <AdminAudit />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AuthenticatedApp />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </I18nProvider>
  );
}
