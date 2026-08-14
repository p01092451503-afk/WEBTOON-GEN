import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useImageHistory, type ImageHistoryRow } from "@/hooks/useImageHistory";
import { SignedImage } from "@/components/SignedImage";
import { ImageDownloadMenu } from "@/components/image-download-menu";
import { ImageLightbox, type LightboxItem } from "@/components/image-lightbox";
import { SignedVideo } from "@/components/SignedVideo";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/icon-tooltip";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Clock,
  Film,
  Trash2,
  Search,
  ImagePlus,
  Pencil,
  X,
  Maximize2,
} from "lucide-react";
import { getKoreanVideoErrorSummary } from "@/lib/video-errors";
import { generateErrorKey } from "@/lib/generate-error";
import { copyOutputToRefs, pushEditAndGo, pushReferenceAndGo } from "@/lib/historyActions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function ConfirmDelete({
  title,
  description,
  onConfirm,
  disabled,
  children,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild disabled={disabled}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : undefined,
    tab: s.tab === "video" ? "video" : "image",
  }),
  head: () => ({ meta: [{ title: "History · pilottoon" }] }),
});

type VideoRow = {
  id: string;
  status: string;
  mode: string;
  work_label: string;
  aspect_ratio: string | null;
  resolution: string | null;
  duration_seconds: number | null;
  api_model: string | null;
  api_model_version: string | null;
  actual_resolution: string | null;
  actual_duration_seconds: number | null;
  moderation_status: string;
  seed: number | null;
  final_prompt: string | null;
  raw_prompt: string | null;
  prompt_edited: boolean;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  results: {
    id: string;
    seq: number;
    storage_path: string;
    poster_path: string | null;
    duration_seconds: number | null;
  }[];
};

type ResultItem = {
  id: string;
  generationId: string;
  workLabel: string;
  seq: number;
  path: string | null;
  seed: number | null;
  createdAt: string;
  prompt: string | null;
  aspectRatio: string | null;
  status: string;
  errorMessage: string | null;
  options?: any;
};

type SortKey = "newest" | "oldest" | "prompt_asc" | "prompt_desc" | "label_asc";

function useVideoHistory(tenantId: string | null) {
  const [rows, setRows] = useState<VideoRow[] | null>(null);
  useState<(() => void) | undefined>(undefined);
  useMemo(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("video_generations")
        .select(
          "id, status, mode, work_label, aspect_ratio, resolution, duration_seconds, actual_resolution, actual_duration_seconds, api_model, api_model_version, moderation_status, seed, final_prompt, raw_prompt, prompt_edited, error_message, created_at, completed_at, video_results(id, seq, storage_path, poster_path, duration_seconds)",
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
          results: (r.video_results ?? []).sort((a: any, b: any) => a.seq - b.seq),
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);
  return { rows, setRows };
}

/** Delete video generations plus their stored files. */
async function deleteVideoGenerations(rows: VideoRow[]) {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;

  const paths = rows.flatMap((r) =>
    r.results.flatMap((res) =>
      [res.storage_path, res.poster_path].filter((p): p is string => Boolean(p)),
    ),
  );
  if (paths.length > 0) {
    await supabase.storage.from("generation-outputs").remove(paths);
  }

  await supabase.from("video_results").delete().in("video_generation_id", ids);
  const { error } = await supabase.from("video_generations").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

function HistoryPage() {
  const { t, i18n } = useTranslation();
  const { tenantId } = useTenant();
  const { rows } = useImageHistory(tenantId);
  const { rows: videoRows, setRows: setVideoRows } = useVideoHistory(tenantId);
  const [busy, setBusy] = useState(false);
  const { id, tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const locale = i18n.language.startsWith("ko") ? "ko-KR" : "en-US";

  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [cols, setCols] = useState(3);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleted, setDeleted] = useState<string[]>([]);

  const resultItems: ResultItem[] = useMemo(() => {
    if (!rows) return [];
    return rows.flatMap((r) =>
      r.results.map((res) => ({
        id: res.id,
        generationId: r.id,
        workLabel: r.work_label,
        seq: res.seq,
        path: res.storage_path ?? res.thumb_path,
        seed: r.seed,
        createdAt: r.created_at,
        prompt: r.final_prompt,
        aspectRatio: r.aspect_ratio,
        status: r.status,
        errorMessage: r.error_message,
        options: r.options,
      })),
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return resultItems;
    return resultItems.filter(
      (it) =>
        (it.prompt ?? "").toLowerCase().includes(q) ||
        it.createdAt.includes(q) ||
        (it.workLabel ?? "").toLowerCase().includes(q),
    );
  }, [resultItems, searchQuery]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "oldest":
        return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      case "prompt_asc":
        return list.sort((a, b) => (a.prompt ?? "").localeCompare(b.prompt ?? ""));
      case "prompt_desc":
        return list.sort((a, b) => (b.prompt ?? "").localeCompare(a.prompt ?? ""));
      case "label_asc":
        return list.sort((a, b) => a.workLabel.localeCompare(b.workLabel));
      case "newest":
      default:
        return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  }, [filtered, sort]);

  const visible = sorted.filter((it) => !deleted.includes(it.id));

  const lightboxItems: LightboxItem[] = visible.map((it) => ({
    id: it.id,
    bucket: "generation-outputs",
    path: it.path,
    alt: `#${it.seq + 1}`,
    info: [
      { label: t("history.meta.mode"), value: it.status },
      { label: t("history.meta.ratio"), value: it.aspectRatio ?? "—" },
      { label: t("history.meta.created"), value: formatTime(it.createdAt, locale) },
      { label: t("history.meta.seed"), value: it.seed != null ? String(it.seed) : "—" },
      { label: t("history.final_prompt"), value: it.prompt ?? "—" },
    ],
  }));

  async function handleDelete(item: ResultItem) {
    try {
      if (item.path) await supabase.storage.from("generation-outputs").remove([item.path]);
      const { error } = await supabase.from("generation_results").delete().eq("id", item.id);
      if (error) throw new Error(error.message);
      setDeleted((prev) => [...prev, item.id]);
      setLightboxIndex(null);
      toast.success(t("common.delete", "삭제"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleUseAsReference(item: ResultItem) {
    if (!item.path) return;
    const dest = await copyOutputToRefs(tenantId, item.path);
    if (!dest) return;
    pushReferenceAndGo(dest, `#${item.seq + 1}`);
  }

  async function handleEditImage(item: ResultItem) {
    if (!item.path) return;
    const dest = await copyOutputToRefs(tenantId, item.path);
    if (!dest) return;
    pushEditAndGo(dest, item.options, item.aspectRatio, item.prompt);
  }

  async function removeVideos(targets: VideoRow[]) {
    if (targets.length === 0) return;
    setBusy(true);
    try {
      await deleteVideoGenerations(targets);
      const removed = new Set(targets.map((r) => r.id));
      setVideoRows((prev) => (prev ?? []).filter((r) => !removed.has(r.id)));
      if (id && removed.has(id)) navigate({ search: { tab, id: undefined } });
      toast.success(`Deleted ${targets.length} item${targets.length > 1 ? "s" : ""}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const failedCount = (videoRows ?? []).filter((r) => r.status === "error").length;

  return (
    <main className="max-w-[1400px] px-5 py-8 sm:py-10">
      {lightboxIndex !== null && lightboxItems[lightboxIndex] && (
        <ImageLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          renderActions={(li) => {
            const it = visible.find((x) => x.id === li.id);
            if (!it) return null;
            return (
              <>
                <HistoryAction onClick={() => handleUseAsReference(it)} icon={<ImagePlus className="h-3.5 w-3.5" />}>
                  {t("history.use_as_ref", "레퍼런스로 사용")}
                </HistoryAction>
                <HistoryAction onClick={() => handleEditImage(it)} icon={<Pencil className="h-3.5 w-3.5" />}>
                  {t("history.edit_image", "이미지 수정")}
                </HistoryAction>
                <ImageDownloadMenu
                  bucket="generation-outputs"
                  path={it.path}
                  baseName={`${it.workLabel}-${it.seq + 1}`}
                  size="sm"
                  variant="secondary"
                  buttonClassName="h-8 rounded-lg"
                />
                <HistoryAction
                  onClick={() => handleDelete(it)}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  tone="danger"
                >
                  {t("common.delete", "삭제")}
                </HistoryAction>
              </>
            );
          }}
        />
      )}

      <header className="min-w-0 sm:flex sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-primary">{t("history.eyebrow")}</div>
          <h1 className="mt-1 truncate text-3xl font-extrabold tracking-tight">
            {t("history.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("history.sub")}</p>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 shadow-toss sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-full bg-muted p-1">
          {(["image", "video"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => navigate({ search: { tab: k, id: undefined } })}
              className={
                "rounded-full px-4 py-1.5 text-xs font-bold transition " +
                (tab === k
                  ? "bg-card text-foreground shadow-toss-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {k === "image" ? t("history.tab_image", "이미지") : t("history.tab_video", "영상")}
            </button>
          ))}
        </div>

        {tab === "image" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("history.search_placeholder", "프롬프트, 날짜, 작업명 검색")}
                className="h-9 rounded-full pl-9 text-sm"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 w-40 rounded-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t("history.sort.newest", "최신순")}</SelectItem>
                <SelectItem value="oldest">{t("history.sort.oldest", "오래된순")}</SelectItem>
                <SelectItem value="prompt_asc">{t("history.sort.prompt_asc", "프롬프트 오름차순")}</SelectItem>
                <SelectItem value="prompt_desc">{t("history.sort.prompt_desc", "프롬프트 내림차순")}</SelectItem>
                <SelectItem value="label_asc">{t("history.sort.label_asc", "작업명 순")}</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
              <Maximize2 className="h-3.5 w-3.5" />
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={6 - cols}
                onChange={(e) => setCols(6 - Number(e.target.value))}
                aria-label={t("history.zoom", "표시 크기")}
                className="h-1 w-24 cursor-pointer accent-[var(--primary)]"
              />
            </label>
          </div>
        )}
      </div>

      {tab === "image" && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {t("history.retention_policy", "생성 결과는 서비스 보관 정책에 따라 일정 기간 후 자동 삭제될 수 있습니다.")}
        </p>
      )}

      {tab === "video" && (videoRows?.length ?? 0) > 0 && (
        <div className="mt-4 flex gap-2">
          {failedCount > 0 && (
            <ConfirmDelete
              title="Delete failed items?"
              description={`${failedCount} failed generation${failedCount > 1 ? "s" : ""} will be permanently removed.`}
              disabled={busy}
              onConfirm={() => removeVideos((videoRows ?? []).filter((r) => r.status === "error"))}
            >
              <Button size="sm" variant="outline" className="rounded-full">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Clear failed ({failedCount})
              </Button>
            </ConfirmDelete>
          )}
          <ConfirmDelete
            title="Delete all history?"
            description="Every video in your history and its stored file will be permanently removed."
            disabled={busy}
            onConfirm={() => removeVideos(videoRows ?? [])}
          >
            <Button size="sm" variant="outline" className="rounded-full text-destructive">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Delete all
            </Button>
          </ConfirmDelete>
        </div>
      )}

      {tab === "image" ? (
        rows === null ? (
          <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : visible.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Clock className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold">{t("history.empty_title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("history.empty_hint_before")}{" "}
              <Link to="/generate" className="font-semibold text-primary underline">
                {t("history.empty_hint_link")}
              </Link>
              {t("history.empty_hint_after")}
            </p>
          </div>
        ) : (
          <div
            className="mt-6 grid gap-4"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {visible.map((it) => (
              <figure
                key={it.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-toss-sm transition hover:shadow-toss"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(visible.findIndex((x) => x.id === it.id))}
                  aria-label={t("lightbox.open")}
                  className="block w-full cursor-zoom-in"
                >
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {it.path ? (
                      <SignedImage
                        bucket="generation-outputs"
                        path={it.path}
                        alt={`${it.workLabel}-${it.seq + 1}`}
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        {it.status === "error" ? t("history.failed") : it.status}
                      </div>
                    )}
                  </div>
                </button>

                <figcaption className="space-y-2 border-t border-border p-3">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>{formatTime(it.createdAt, locale)}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono">
                      #{it.seq + 1}
                    </span>
                  </div>
                  {it.prompt && (
                    <p
                      className="line-clamp-2 text-[11px] leading-tight text-muted-foreground"
                      title={it.prompt}
                    >
                      {it.prompt}
                    </p>
                  )}
                  <div className="flex items-center gap-1">
                    <CardAction onClick={() => handleUseAsReference(it)} icon={<ImagePlus className="h-3 w-3" />}>
                      {t("history.use_as_ref", "레퍼런스로 사용")}
                    </CardAction>
                    <CardAction onClick={() => handleEditImage(it)} icon={<Pencil className="h-3 w-3" />}>
                      {t("history.edit_image", "이미지 수정")}
                    </CardAction>
                    <ImageDownloadMenu
                      bucket="generation-outputs"
                      path={it.path}
                      baseName={`${it.workLabel}-${it.seq + 1}`}
                      size="icon"
                      variant="secondary"
                      buttonClassName="h-7 w-7 shrink-0 rounded-lg"
                    />
                    <ConfirmDelete
                      title={t("history.delete_result", "결과 삭제")}
                      description={t("history.delete_result_desc", "이 결과와 저장된 파일이 영구 삭제됩니다.")}
                      onConfirm={() => handleDelete(it)}
                    >
                      <button
                        type="button"
                        aria-label={t("common.delete")}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </ConfirmDelete>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )
      ) : videoRows === null ? (
        <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : videoRows.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-border bg-card p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Film className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-semibold">{t("history.empty_title")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("history.empty_hint_before")}{" "}
            <Link to="/video" className="font-semibold text-primary underline">
              {t("history.empty_hint_link")}
            </Link>
            {t("history.empty_hint_after")}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videoRows.map((r) => {
            const first = r.results[0];
            return (
              <div
                key={r.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-toss-sm transition hover:shadow-toss"
              >
                <button
                  onClick={() => navigate({ search: { id: r.id, tab: "video" } })}
                  className="block w-full text-left"
                >
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    {first?.storage_path ? (
                      <SignedVideo
                        bucket="generation-outputs"
                        path={first.storage_path}
                        posterPath={first.poster_path}
                        controls={false}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        {r.status === "error" ? t("history.failed") : r.status}
                      </div>
                    )}
                    <div className="absolute left-2 top-2">
                      <StatusPill status={r.status} />
                    </div>
                  </div>
                  <div className="space-y-1 p-3 pr-12">
                    <div className="truncate text-sm font-bold">{r.work_label}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {r.final_prompt ?? ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString(locale)}
                    </div>
                  </div>
                </button>
                <div className="absolute bottom-3 right-3">
                  <ConfirmDelete
                    title="Delete this video?"
                    description="This generation and its stored video file will be permanently removed."
                    disabled={busy}
                    onConfirm={() => removeVideos([r])}
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete generation"
                      className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </ConfirmDelete>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function CardAction({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-muted px-2 text-[10px] font-bold text-foreground transition hover:bg-primary-soft hover:text-primary"
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

function HistoryAction({
  onClick,
  icon,
  children,
  tone,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition " +
        (tone === "danger"
          ? "border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
          : "border-white/15 bg-white/5 text-neutral-100 hover:bg-white/15")
      }
    >
      {icon}
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "done"
      ? "bg-emerald-500/90 text-white"
      : status === "error"
        ? "bg-destructive/90 text-white"
        : "bg-amber-500/90 text-white";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
      {status}
    </span>
  );
}

function formatTime(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale);
}
