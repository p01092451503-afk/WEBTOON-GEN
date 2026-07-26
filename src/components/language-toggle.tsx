import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { LANGS, type Lang } from "@/i18n";

/**
 * Compact EN / KO segmented toggle for the app header.
 * SSR-safe: renders a neutral placeholder until hydrated, then reflects the active language.
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = (mounted ? (i18n.resolvedLanguage as Lang) : "en") || "en";

  function setLang(lng: Lang) {
    void i18n.changeLanguage(lng);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("toonpilot:lang", lng);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div
      className="hidden items-center gap-0.5 rounded-full border border-border bg-card p-0.5 sm:flex"
      role="group"
      aria-label="Language"
    >
      <Globe className="ml-2 mr-0.5 h-3.5 w-3.5 text-muted-foreground" />
      {LANGS.map((lng) => {
        const isActive = active === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => setLang(lng)}
            className={
              "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase transition " +
              (isActive
                ? "bg-primary text-primary-foreground shadow-toss-sm"
                : "text-muted-foreground hover:text-foreground")
            }
            aria-pressed={isActive}
          >
            {lng}
          </button>
        );
      })}
    </div>
  );
}
