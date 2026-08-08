import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkImageModelHealth } from "@/lib/image-health.functions";

type ValidationState =
  | "valid" | "invalid" | "missing" | "available"
  | "unavailable" | "configured" | "not_configured" | "unknown";

type HealthModel = {
  label: string;
  modelName?: string;
  status: "available" | "unavailable" | "unknown";
  detail: string;
  validation: {
    credential: ValidationState;
    baseUrl: ValidationState;
    endpoint: ValidationState;
    configuredEndpoint: string | null;
  };
};

type Health = { checkedAt: string; models: HealthModel[] };

function stateKey(value: ValidationState) {
  if (value === "valid" || value === "available") return "ready";
  if (value === "configured") return "configured";
  if (value === "not_configured") return "not_configured";
  if (value === "invalid" || value === "unavailable" || value === "missing") return "attention";
  return "unknown";
}

function ValidationItem({ label, value, hint }: { label: string; value: ValidationState; hint?: string | null }) {
  const { t } = useTranslation();
  const key = stateKey(value);
  const positive = key === "ready" || key === "configured";
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
      <span className="truncate text-muted-foreground">{hint ? `${label} · ${hint}` : label}</span>
      <span className={positive ? "shrink-0 font-bold text-primary" : "shrink-0 font-bold text-muted-foreground"}>
        {t(`image_health.state.${key}`)}
      </span>
    </div>
  );
}

export function ImageModelHealthCard() {
  const { t, i18n } = useTranslation();
  const checkHealth = useServerFn(checkImageModelHealth);
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);

  const run = useCallback(
    async (notify: boolean) => {
      setChecking(true);
      try {
        const result = (await checkHealth({ data: undefined })) as Health;
        setHealth(result);
        if (notify) toast.success(t("image_health.toast_ok"));
      } catch {
        if (notify) toast.error(t("image_health.toast_fail"));
      } finally {
        setChecking(false);
      }
    },
    [checkHealth, t],
  );

  useEffect(() => {
    void run(false);
  }, [run]);

  const model = health?.models[0] ?? null;
  const ready = model?.status === "available";

  return (
    <section className="mt-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {ready ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold">{t("image_health.title")}</h2>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold">
              {model ? model.status : checking ? t("image_health.checking") : t("image_health.unchecked")}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => void run(true)}
              disabled={checking}
            >
              <RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {t("image_health.check")}
            </Button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {model ? model.detail : t("image_health.loading_detail")}
          </p>
          {model && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <ValidationItem label={t("image_health.api_key")} value={model.validation.credential} />
              <ValidationItem label={t("image_health.base_url")} value={model.validation.baseUrl} />
              <ValidationItem
                label={t("image_health.endpoint")}
                value={model.validation.endpoint}
                hint={model.validation.configuredEndpoint}
              />
            </div>
          )}
          {health && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t("image_health.last_checked")}:{" "}
              {new Date(health.checkedAt).toLocaleString(i18n.language === "ko" ? "ko-KR" : "en-US")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
