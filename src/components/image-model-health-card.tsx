import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkImageModelHealth } from "@/lib/image-health.functions";

type ValidationState =
  | "valid" | "invalid" | "missing" | "available"
  | "unavailable" | "configured" | "not_configured" | "unknown";

type HealthModel = {
  label: string;
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

function stateLabel(value: ValidationState) {
  if (value === "valid" || value === "available") return "준비됨";
  if (value === "configured") return "설정됨";
  if (value === "not_configured") return "미설정";
  if (value === "invalid" || value === "unavailable" || value === "missing") return "확인 필요";
  return "알 수 없음";
}

function ValidationItem({ label, value, hint }: { label: string; value: ValidationState; hint?: string | null }) {
  const positive = value === "valid" || value === "available" || value === "configured";
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
      <span className="truncate text-muted-foreground">{hint ? `${label} · ${hint}` : label}</span>
      <span className={positive ? "shrink-0 font-bold text-primary" : "shrink-0 font-bold text-muted-foreground"}>
        {stateLabel(value)}
      </span>
    </div>
  );
}

export function ImageModelHealthCard() {
  const checkHealth = useServerFn(checkImageModelHealth);
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);

  const run = useCallback(
    async (notify: boolean) => {
      setChecking(true);
      try {
        const result = (await checkHealth({ data: undefined })) as Health;
        setHealth(result);
        if (notify) toast.success("ARK 연결 상태를 확인했습니다.");
      } catch {
        if (notify) toast.error("연결 확인에 실패했습니다.");
      } finally {
        setChecking(false);
      }
    },
    [checkHealth],
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
            <h2 className="text-sm font-bold">ARK / Seedream 연결 상태</h2>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold">
              {model ? model.status : checking ? "확인 중" : "미확인"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => void run(true)}
              disabled={checking}
            >
              <RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              ARK 연결 확인
            </Button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {model ? model.detail : "이미지 모델 연결 상태를 확인하는 중입니다."}
          </p>
          {model && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <ValidationItem label="API 키" value={model.validation.credential} />
              <ValidationItem label="ARK 주소" value={model.validation.baseUrl} />
              <ValidationItem
                label="이미지 엔드포인트"
                value={model.validation.endpoint}
                hint={model.validation.configuredEndpoint}
              />
            </div>
          )}
          {health && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              마지막 확인: {new Date(health.checkedAt).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
