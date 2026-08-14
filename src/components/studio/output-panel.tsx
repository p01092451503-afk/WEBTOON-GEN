import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  GitCompare,
  ImagePlus,
  Loader2,
  Lock,
  Maximize2,
  Pencil,
  RotateCcw,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { ImageDownloadMenu } from "@/components/image-download-menu";
import { ImageLightbox, type LightboxItem } from "@/components/image-lightbox";
import { IconTooltip } from "@/components/icon-tooltip";
import { Button } from "@/components/ui/button";
import { useImageHistory } from "@/hooks/useImageHistory";

export const OUTPUT_BUCKET = "generation-outputs";

export type OutputItem = {
  id: string;
  generationId: string;
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

type Tab = "line" | "history";

export function StudioOutputPanel({
  tenantId,
  lineItems,
  running,
  pendingCount,
  statusRow,
  lockedSeeds,
  onToggleLock,
  compareIds,
  onToggleCompare,
  onClearLine,
  onUseAsReference,
  onEditImage,
  onSetAsPanel,
  onVaryRest,
}: {
  tenantId: string | null;
  lineItems: OutputItem[];
  running: boolean;
  pendingCount: number;
  statusRow: { status: string; error_message: string | null } | null;
  lockedSeeds: Record<number, number>;
  onToggleLock: (seq: number, seed: number | null) => void;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onClearLine: () => void;
  onUseAsReference: (item: OutputItem) => void;
  onEditImage: (item: OutputItem) => void;
  onSetAsPanel: ((resultId: string) => void) | null;
  onVaryRest: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("line");
  const [cols, setCols] = useState(2);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleted, setDeleted] = useState<string[]>([]);
  const { rows: historyRows } = useImageHistory(tenantId, 60);

  const historyItems: OutputItem[] = useMemo(() => {
    if (!historyRows) return [];
    return historyRows.flatMap((r) =>
      r.results.map((res) => ({
        id: res.id,
        generationId: r.id,
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
  }, [historyRows]);

  const items = (tab === "line" ? lineItems : historyItems).filter(
    (it) => !deleted.includes(it.id),
  );

  const lightboxItems: LightboxItem[] = items.map((it) => ({
    id: it.id,
    bucket: OUTPUT_BUCKET,
    path: it.path,
    alt: `#${it.seq + 1}`,
    info: [
      { label: t("studio.output.info_format", "형식"), value: fileExt(it.path) },
      { label: t("studio.output.info_ratio", "비율"), value: it.aspectRatio ?? "—" },
      { label: t("studio.output.info_created", "생성일"), value: formatTime(it.createdAt) },
      { label: t("studio.output.info_seed", "시드"), value: it.seed != null ? String(it.seed) : "—" },
      { label: t("studio.output.info_prompt", "프롬프트"), value: it.prompt ?? "—" },
    ],
  }));

  async function handleDelete(item: OutputItem) {
    try {
      if (item.path) await supabase.storage.from(OUTPUT_BUCKET).remove([item.path]);
      const { error } = await supabase.from("generation_results").delete().eq("id", item.id);
      if (error) throw new Error(error.message);
      setDeleted((prev) => [...prev, item.id]);
      setLightboxIndex(null);
      toast.success(t("studio.output.deleted", "삭제했습니다."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  const gridStyle = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };

  return (
    <section className="rounded-3xl bg-card p-4 shadow-toss sm:p-5">
      {lightboxIndex !== null && lightboxItems[lightboxIndex] && (
        <ImageLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          renderActions={(li) => {
            const it = items.find((x) => x.id === li.id);
            if (!it) return null;
            return (
              <>
                <ViewerAction onClick={() => onUseAsReference(it)} icon={<ImagePlus className="h-3.5 w-3.5" />}>
                  {t("studio.output.use_as_ref", "레퍼런스로 사용")}
                </ViewerAction>
                <ViewerAction onClick={() => onEditImage(it)} icon={<Pencil className="h-3.5 w-3.5" />}>
                  {t("studio.output.edit_image", "이미지 수정")}
                </ViewerAction>
                <ImageDownloadMenu
                  bucket={OUTPUT_BUCKET}
                  path={it.path}
                  baseName={`toonpilot-${it.seq + 1}`}
                  size="sm"
                  variant="secondary"
                  buttonClassName="h-8 rounded-lg"
                />
                <ViewerAction
                  onClick={() => handleDelete(it)}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  tone="danger"
                >
                  {t("common.delete", "삭제")}
                </ViewerAction>
              </>
            );
          }}
        />
      )}

      {/* 상단 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-muted p-1">
          {(["line", "history"] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k);
                setLightboxIndex(null);
              }}
              className={
                "rounded-full px-4 py-1.5 text-xs font-bold transition " +
                (tab === k ? "bg-card text-foreground shadow-toss-sm" : "text-muted-foreground hover:text-foreground")
              }
            >
              {k === "line"
                ? t("studio.output.tab_line", "라인")
                : t("studio.output.tab_history", "히스토리")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {tab === "line" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearLine}
              disabled={lineItems.length === 0}
              className="h-8 rounded-full text-xs font-semibold text-muted-foreground"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              {t("studio.output.clear_line", "라인 초기화")}
            </Button>
          )}
          <label className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <Maximize2 className="h-3.5 w-3.5" />
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={6 - cols}
              onChange={(e) => setCols(6 - Number(e.target.value))}
              aria-label={t("studio.output.zoom", "표시 크기")}
              className="h-1 w-24 cursor-pointer accent-[var(--primary)]"
            />
          </label>
        </div>
      </div>

      {tab === "line" && statusRow?.error_message && (
        <p className="mt-3 break-all rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
          {statusRow.error_message}
        </p>
      )}

      {/* 그리드 */}
      <div className="mt-4 grid gap-3" style={gridStyle}>
        {tab === "line" &&
          running &&
          Array.from({ length: Math.max(1, pendingCount) }).map((_, i) => (
            <div
              key={`sk-${i}`}
              className="grid aspect-square place-items-center rounded-2xl border border-dashed border-border bg-muted/40"
            >
              <div className="flex flex-col items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                {statusRow?.status ?? t("common.generating_image")}
              </div>
            </div>
          ))}

        {items.map((it) => {
          const locked = it.seed != null && lockedSeeds[it.seq] === it.seed;
          const inCompare = compareIds.includes(it.id);
          return (
            <figure
              key={it.id}
              className={
                "group relative overflow-hidden rounded-2xl border bg-muted/30 " +
                (inCompare ? "border-primary ring-2 ring-primary" : "border-border")
              }
            >
              <button
                type="button"
                onClick={() => setLightboxIndex(items.findIndex((x) => x.id === it.id))}
                aria-label={t("lightbox.open")}
                className="block w-full cursor-zoom-in"
              >
                <SignedImage
                  bucket={OUTPUT_BUCKET}
                  path={it.path}
                  alt={`result-${it.seq + 1}`}
                  className="aspect-square w-full object-cover"
                />
              </button>

              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-1.5">
                <span className="rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur">
                  #{it.seq + 1}
                  {it.seed != null ? ` · ${it.seed}` : ""}
                </span>
                <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  {tab === "line" && (
                    <>
                      <IconTooltip label={locked ? t("common.unlock_seed") : t("common.lock_seed")}>
                        <button
                          type="button"
                          onClick={() => onToggleLock(it.seq, it.seed)}
                          disabled={it.seed == null}
                          aria-label={locked ? t("common.unlock_seed") : t("common.lock_seed")}
                          className={
                            "grid h-6 w-6 place-items-center rounded-md text-white " +
                            (locked ? "bg-primary" : "bg-black/55 hover:bg-black/75 disabled:opacity-40")
                          }
                        >
                          {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        </button>
                      </IconTooltip>
                      <IconTooltip label={t("studio.labels.compare")}>
                        <button
                          type="button"
                          onClick={() => onToggleCompare(it.id)}
                          aria-label={t("studio.labels.compare")}
                          className={
                            "grid h-6 w-6 place-items-center rounded-md text-white " +
                            (inCompare ? "bg-primary" : "bg-black/55 hover:bg-black/75")
                          }
                        >
                          <GitCompare className="h-3 w-3" />
                        </button>
                      </IconTooltip>
                    </>
                  )}
                </div>
              </div>

              <figcaption className="space-y-2 border-t border-border bg-card/90 p-2">
                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>{formatTime(it.createdAt)}</span>
                  {onSetAsPanel && (
                    <button
                      type="button"
                      onClick={() => onSetAsPanel(it.id)}
                      className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground"
                    >
                      {t("studio.labels.use_for_panel")}
                    </button>
                  )}
                </div>
                {it.prompt && (
                  <p className="line-clamp-2 text-[11px] leading-tight text-muted-foreground" title={it.prompt}>
                    {it.prompt}
                  </p>
                )}
                <div className="flex items-center gap-1">
                  <CardAction onClick={() => onUseAsReference(it)} icon={<ImagePlus className="h-3 w-3" />}>
                    {t("studio.output.use_as_ref", "레퍼런스로 사용")}
                  </CardAction>
                  <CardAction onClick={() => onEditImage(it)} icon={<Pencil className="h-3 w-3" />}>
                    {t("studio.output.edit_image", "이미지 수정")}
                  </CardAction>
                  <ImageDownloadMenu
                    bucket={OUTPUT_BUCKET}
                    path={it.path}
                    baseName={`toonpilot-${it.seq + 1}`}
                    size="icon"
                    variant="secondary"
                    buttonClassName="h-7 w-7 shrink-0 rounded-lg"
                  />
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {items.length === 0 && !running && (
        <div className="mt-4 grid place-items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm font-semibold">
            {tab === "line"
              ? t("studio.output.empty_line", "아직 생성한 이미지가 없어요.")
              : t("studio.output.empty_history", "히스토리가 비어 있어요.")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("studio.output.empty_hint", "왼쪽에서 조건을 설정하고 이미지를 만들어 보세요.")}
          </p>
        </div>
      )}

      {tab === "line" && Object.keys(lockedSeeds).length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onVaryRest}
            disabled={running}
            className="flex-1 rounded-full text-xs font-semibold"
          >
            <Lock className="mr-1 h-3.5 w-3.5" />
            {t("studio.labels.vary_the_rest", { count: Object.keys(lockedSeeds).length })}
          </Button>
        </div>
      )}

      {tab === "line" && compareIds.length === 2 && (
        <CompareStrip
          items={lineItems.filter((it) => compareIds.includes(it.id))}
          onClose={() => compareIds.forEach((id) => onToggleCompare(id))}
        />
      )}
    </section>
  );
}

function CompareStrip({ items, onClose }: { items: OutputItem[]; onClose: () => void }) {
  const { t } = useTranslation();
  if (items.length !== 2) return null;
  return (
    <div className="mt-4 rounded-2xl border border-primary/40 bg-primary-soft/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-primary">{t("studio.labels.compare_title")}</span>
        <IconTooltip label={t("common.close_compare")}>
          <button onClick={onClose} aria-label={t("common.close_compare")} className="rounded-full p-1 hover:bg-black/5">
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </IconTooltip>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it, i) => (
          <div key={it.id} className="space-y-1">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">
              {i === 0 ? "A" : "B"} · seed {it.seed ?? "—"}
            </div>
            <SignedImage
              bucket={OUTPUT_BUCKET}
              path={it.path}
              alt={`compare-${i}`}
              className="aspect-square w-full rounded-xl border border-border object-cover"
            />
          </div>
        ))}
      </div>
    </div>
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

function ViewerAction({
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

function fileExt(path: string | null) {
  if (!path) return "—";
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? m[1].toUpperCase() : "—";
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}
