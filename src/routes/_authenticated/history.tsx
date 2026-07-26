import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Clock, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({ meta: [{ title: "히스토리 · toonpilot" }] }),
});

type Row = {
  id: string;
  status: string;
  mode: string;
  work_label: string;
  aspect_ratio: string | null;
  api_model: string | null;
  seed: number | null;
  final_prompt: string | null;
  compiled_prompt: string | null;
  options: any;
  figure_map: any;
  warnings: any;
  batch_count: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  results: { id: string; seq: number; storage_path: string | null }[];
};

function useHistory(tenantId: string | null) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("generations")
        .select(
          "id, status, mode, work_label, aspect_ratio, api_model, seed, final_prompt, compiled_prompt, options, figure_map, warnings, batch_count, error_message, created_at, completed_at, generation_results(id, seq, storage_path)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setRows([]);
        return;
      }
      setRows(
        (data ?? []).map((r: any) => ({
          ...r,
          results: (r.generation_results ?? []).sort((a: any, b: any) => a.seq - b.seq),
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);
  return rows;
}

function HistoryPage() {
  const { tenantId } = useTenant();
  const rows = useHistory(tenantId);
  const { id } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selected = rows?.find((r) => r.id === id) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
      <header className="min-w-0">
        <div className="text-xs font-semibold text-primary">활동</div>
        <h1 className="mt-1 truncate text-3xl font-extrabold tracking-tight">히스토리</h1>
        <p className="mt-1 text-sm text-muted-foreground">최근 100건의 생성 기록을 볼 수 있어요.</p>
      </header>

      {selected && (
        <div className="mt-6">
          <DetailCard row={selected} onClose={() => navigate({ search: {} })} />
        </div>
      )}

      {rows === null ? (
        <p className="mt-8 text-sm text-muted-foreground">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-border bg-card p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Clock className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-semibold">아직 생성 이력이 없어요</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <Link to="/generate" className="font-semibold text-primary underline">
              생성 화면
            </Link>
            에서 첫 이미지를 만들어보세요.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => {
            const first = r.results[0];
            return (
              <button
                key={r.id}
                onClick={() => navigate({ search: { id: r.id } })}
                className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-toss-sm transition hover:shadow-toss"
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {first?.storage_path ? (
                    <SignedImage
                      bucket="generation-outputs"
                      path={first.storage_path}
                      alt={r.work_label}
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      {r.status === "error" ? "실패" : r.status}
                    </div>
                  )}
                  <div className="absolute left-2 top-2">
                    <StatusPill status={r.status} />
                  </div>
                </div>
                <div className="space-y-1 p-3">
                  <div className="truncate text-sm font-bold">{r.work_label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    done: "bg-emerald-100 text-emerald-700",
    error: "bg-destructive/10 text-destructive",
    queued: "bg-white/90 text-muted-foreground",
    running: "bg-primary-soft text-primary",
  };
  const cls = styles[status] ?? "bg-white/90 text-muted-foreground";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-toss-sm ${cls}`}>
      {status}
    </span>
  );
}

function DetailCard({ row, onClose }: { row: Row; onClose: () => void }) {
  function loadIntoGenerate() {
    try {
      sessionStorage.setItem(
        "toonpilot:restore",
        JSON.stringify({
          workLabel: row.work_label,
          mode: row.mode,
          aspectRatio: row.aspect_ratio,
          batchCount: row.batch_count,
          options: row.options,
          figureMap: row.figure_map,
          finalPrompt: row.final_prompt,
        }),
      );
      toast.success("생성 화면으로 이동하면 옵션이 복원돼요");
    } catch {
      toast.error("복원 데이터 저장 실패");
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-toss">
      <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-base font-bold">{row.work_label}</h3>
          <StatusPill status={row.status} />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" asChild className="rounded-full">
            <Link to="/generate" onClick={loadIntoGenerate}>
              설정 불러오기
            </Link>
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="space-y-5">
        {row.results.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {row.results.map((res) => (
              <div key={res.id} className="overflow-hidden rounded-xl border border-border bg-muted">
                {res.storage_path && (
                  <SignedImage
                    bucket="generation-outputs"
                    path={res.storage_path}
                    alt={`result-${res.seq}`}
                    className="aspect-square w-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <Meta label="모드" value={row.mode} />
          <Meta label="비율" value={row.aspect_ratio ?? "-"} />
          <Meta label="모델" value={row.api_model ?? "-"} />
          <Meta label="Seed" value={row.seed?.toString() ?? "-"} />
          <Meta label="배치" value={String(row.batch_count)} />
          <Meta label="생성" value={new Date(row.created_at).toLocaleString("ko-KR")} />
          <Meta
            label="완료"
            value={row.completed_at ? new Date(row.completed_at).toLocaleString("ko-KR") : "-"}
          />
          <Meta
            label="경고"
            value={
              Array.isArray(row.warnings) && row.warnings.length ? String(row.warnings.length) : "0"
            }
          />
        </div>

        {row.error_message && (
          <div className="whitespace-pre-wrap rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {row.error_message}
          </div>
        )}

        {row.final_prompt && (
          <div>
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Final Prompt</div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-xs">
              {row.final_prompt}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-medium">{value}</div>
    </div>
  );
}
