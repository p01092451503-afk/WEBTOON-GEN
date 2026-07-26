import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: "/history" });
  const rows = useHistory(tenantId);

  const selected = id ? rows?.find((r) => r.id === id) ?? null : null;

  if (!rows) {
    return <main className="max-w-6xl mx-auto p-6 text-sm text-muted-foreground">불러오는 중…</main>;
  }

  if (rows.length === 0) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">히스토리</h1>
        <p className="text-sm text-muted-foreground">
          아직 생성 기록이 없습니다. <Link to="/generate" className="underline">생성 화면</Link>에서 첫 이미지를 만들어보세요.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">히스토리</h1>
        <span className="text-xs text-muted-foreground">최근 {rows.length}건</span>
      </div>

      {selected && (
        <DetailCard
          row={selected}
          onClose={() => navigate({ search: {} })}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {rows.map((r) => {
          const first = r.results[0];
          return (
            <button
              key={r.id}
              onClick={() => navigate({ search: { id: r.id } })}
              className="group text-left border rounded-lg overflow-hidden bg-card hover:ring-2 hover:ring-primary transition"
            >
              <div className="aspect-square bg-muted relative">
                {first?.storage_path ? (
                  <SignedImage
                    bucket="generation-outputs"
                    path={first.storage_path}
                    alt={r.work_label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    {r.status === "error" ? "실패" : r.status}
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <StatusBadge status={r.status} />
                </div>
              </div>
              <div className="p-2 space-y-1">
                <div className="text-xs font-medium truncate">{r.work_label}</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "done" ? "default" : status === "error" ? "destructive" : "secondary";
  return (
    <Badge variant={variant as any} className="text-[10px]">
      {status}
    </Badge>
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
      toast.success("생성 화면으로 이동하면 옵션이 복원됩니다.");
    } catch (e) {
      toast.error("복원 데이터 저장 실패");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          {row.work_label} · <StatusBadge status={row.status} />
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadIntoGenerate} asChild>
            <Link to="/generate" onClick={loadIntoGenerate}>설정 불러오기</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>닫기</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {row.results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {row.results.map((res) => (
              <div key={res.id} className="border rounded overflow-hidden bg-muted">
                {res.storage_path && (
                  <SignedImage
                    bucket="generation-outputs"
                    path={res.storage_path}
                    alt={`result-${res.seq}`}
                    className="w-full aspect-square object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
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
            value={Array.isArray(row.warnings) && row.warnings.length ? String(row.warnings.length) : "0"}
          />
        </div>

        {row.error_message && (
          <div className="text-xs text-destructive whitespace-pre-wrap border border-destructive/40 rounded p-2">
            {row.error_message}
          </div>
        )}

        {row.final_prompt && (
          <div>
            <div className="text-xs font-semibold mb-1">Final Prompt</div>
            <pre className="text-xs whitespace-pre-wrap bg-muted rounded p-2 max-h-64 overflow-auto">
              {row.final_prompt}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="truncate">{value}</div>
    </div>
  );
}
