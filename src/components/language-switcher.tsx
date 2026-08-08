import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { LANGS, LANG_LABELS, setLanguage, type Lang } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const current = (LANGS as readonly string[]).includes(i18n.language)
    ? (i18n.language as Lang)
    : "en";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted ${className}`}
          aria-label={t("common.language")}
        >
          <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          {current.toUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-2xl p-1.5">
        {LANGS.map((lang) => (
          <DropdownMenuItem
            key={lang}
            className="rounded-xl px-2.5 py-2 text-sm"
            onSelect={() => setLanguage(lang)}
          >
            <span className="flex-1">{LANG_LABELS[lang]}</span>
            {current === lang && <span className="text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
