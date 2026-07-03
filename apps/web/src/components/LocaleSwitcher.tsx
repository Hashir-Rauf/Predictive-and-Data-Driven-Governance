import type { Locale } from "@gov-dashboard/shared-types";
import { useI18n } from "../i18n/I18nProvider";

const LOCALES: Locale[] = ["uz", "ru", "en"];

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div role="group" aria-label="Language" className="locale-switcher">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className="locale-switcher__option"
          data-active={code === locale}
          aria-pressed={code === locale}
          onClick={() => setLocale(code)}
        >
          {t(`locale.${code}`)}
        </button>
      ))}
    </div>
  );
}
