import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Film, LayoutGrid } from "lucide-react";

/**
 * Video studio / Studio hub 전환 바. 이미지 스튜디오는 숨겨져 있어
 * Video 만 노출됩니다.
 */
export function StudioSwitcher({ active }: { active: "video" }) {
  const { t } = useTranslation();

  const pill =
    "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-colors";
  const on = "bg-primary text-primary-foreground";
  const off = "text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
        <Link to="/video" className={`${pill} ${active === "video" ? on : off}`}>
          <Film className="h-4 w-4" />
          {t("switcher.video")}
        </Link>
      </div>
      <Link
        to="/studio"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <LayoutGrid className="h-4 w-4" />
        {t("switcher.hub")}
      </Link>
    </div>
  );
}
