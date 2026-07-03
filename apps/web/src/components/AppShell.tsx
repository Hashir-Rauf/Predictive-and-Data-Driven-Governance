import type { Role } from "@gov-dashboard/shared-types";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { useAuth } from "../lib/auth";
import { LocaleSwitcher } from "./LocaleSwitcher";
import "./AppShell.css";

interface NavItem {
  to: string;
  labelKey: string;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "nav.overview" },
  { to: "/regions", labelKey: "nav.regional" },
  { to: "/anomalies", labelKey: "nav.anomalies" },
  { to: "/forecast", labelKey: "nav.forecast" },
  { to: "/policy-brief", labelKey: "nav.policyBrief" },
  { to: "/admin", labelKey: "nav.admin", roles: ["ministry_admin"] },
];

function BrandMark() {
  // Inverted for the ink masthead: paper square, blue bars.
  return (
    <svg className="app-shell__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" fill="var(--color-on-ink-primary)" />
      <rect x="6" y="18" width="5" height="8" fill="var(--color-accent)" />
      <rect x="13.5" y="10" width="5" height="16" fill="var(--color-accent)" />
      <rect x="21" y="14" width="5" height="12" fill="var(--color-accent)" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-inner">
          <div className="app-shell__brand">
            <BrandMark />
            <span className="app-shell__title">{t("app.title")}</span>
          </div>
          <nav className="app-shell__nav" aria-label="Primary">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `app-shell__nav-link${isActive ? " is-active" : ""}`}
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="app-shell__actions">
            <LocaleSwitcher />
            {user ? (
              <button type="button" className="app-shell__logout" onClick={() => logout()}>
                {t("nav.logout")}
              </button>
            ) : null}
          </div>
        </div>
      </header>
      {user ? (
        <div className="app-shell__context-bar">
          <div className="app-shell__context-inner">
            <span className="app-shell__context-user">{user.fullName}</span>
            <span className="app-shell__context-role">{t(`login.role.${user.role}`)}</span>
          </div>
        </div>
      ) : null}
      <main className="app-shell__main">{children}</main>
    </div>
  );
}
