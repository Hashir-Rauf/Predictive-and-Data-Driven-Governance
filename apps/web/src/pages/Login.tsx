import type { Role } from "@gov-dashboard/shared-types";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { useAuth } from "../lib/auth";
import "./Login.css";

const PERSONAS: Role[] = ["ministry_admin", "municipal_viewer", "soe_analyst"];

const PERSONA_SCOPE_KEY: Record<Role, string> = {
  ministry_admin: "login.scope.national",
  municipal_viewer: "login.scope.regional",
  soe_analyst: "login.scope.enterprise",
};

export function Login() {
  const { t } = useI18n();
  const { user, status, loginAsPersona } = useAuth();
  const [pending, setPending] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === "authenticated" && user) {
    return <Navigate to="/" replace />;
  }

  async function handlePersona(role: Role) {
    setPending(role);
    setError(null);
    try {
      await loginAsPersona(role);
    } catch {
      setError(t("common.error"));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__masthead">
          <svg className="login__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <rect width="32" height="32" fill="var(--color-ink-primary)" />
            <rect x="6" y="18" width="5" height="8" fill="var(--color-accent)" />
            <rect x="13.5" y="10" width="5" height="16" fill="var(--color-accent)" />
            <rect x="21" y="14" width="5" height="12" fill="var(--color-accent)" />
          </svg>
          <span className="mono-label">{t("app.title")}</span>
        </div>

        <h1 className="login__title">{t("login.title")}</h1>
        <p className="login__subtitle">{t("login.subtitle")}</p>

        <div className="login__personas">
          {PERSONAS.map((role) => (
            <button
              key={role}
              type="button"
              className="login__persona"
              disabled={pending !== null}
              data-pending={pending === role}
              onClick={() => handlePersona(role)}
            >
              <span className="login__persona-name">{t(`login.role.${role}`)}</span>
              <span className="login__persona-scope">{t(PERSONA_SCOPE_KEY[role])}</span>
            </button>
          ))}
        </div>

        {error ? <p className="error-text login__error">{error}</p> : null}

        <div className="login__footer">
          <span className="mono-label">{t("login.mygovuzNote")}</span>
        </div>
      </div>
    </div>
  );
}
