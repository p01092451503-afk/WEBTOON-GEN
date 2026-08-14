import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { cn } from "@/lib/utils";

export type LightboxItem = {
  id: string;
  bucket: string;
  path: string | null;
  alt: string;
  /** optional metadata shown in the dark viewer info rail */
  info?: { label: string; value: string }[];
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function ImageLightbox({
  items,
  index,
  onIndexChange,
  onClose,
  renderActions,
}: {
  items: LightboxItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  /** action buttons rendered in the viewer footer (use-as-ref / edit / download / delete) */
  renderActions?: (item: LightboxItem) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const item = items[index];
  const url = useSignedUrl(item?.bucket ?? "", item?.path, 600);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // reset transform whenever the visible image changes
  useLayoutEffect(() => {
    reset();
  }, [index, reset]);

  const zoomAt = useCallback((nextZoomRaw: number, px: number, py: number) => {
    const { zoom: z, offset: o } = stateRef.current;
    const next = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM);
    if (next === z) return;
    const k = next / z;
    setZoom(next);
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
  }, []);

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      zoomAt(stateRef.current.zoom * factor, rect.width / 2, rect.height / 2);
    },
    [zoomAt],
  );

  // non-passive wheel listener so preventDefault works (also covers trackpad pinch)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(
        stateRef.current.zoom * Math.exp(-dy * 0.0018),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // keyboard shortcuts + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && items.length > 1) onIndexChange((index + 1) % items.length);
      else if (e.key === "ArrowLeft" && items.length > 1)
        onIndexChange((index - 1 + items.length) % items.length);
      else if (e.key === "+" || e.key === "=") zoomAtCenter(1.25);
      else if (e.key === "-") zoomAtCenter(1 / 1.25);
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, items.length, onClose, onIndexChange, reset, zoomAtCenter]);

  const dragRef = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      ox: stateRef.current.offset.x,
      oy: stateRef.current.offset.y,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  };
  const endDrag = (e: React.PointerEvent) => {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null;
  };

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-neutral-950/97 text-neutral-100 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("lightbox.title")}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium text-neutral-100">{item.alt}</span>
          {items.length > 1 && (
            <span className="font-mono">
              {index + 1} / {items.length}
            </span>
          )}
          <span className="font-mono">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <LightboxButton label={t("lightbox.zoom_out")} onClick={() => zoomAtCenter(1 / 1.25)}>
            <Minus className="h-4 w-4" aria-hidden="true" />
          </LightboxButton>
          <LightboxButton label={t("lightbox.zoom_in")} onClick={() => zoomAtCenter(1.25)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </LightboxButton>
          <LightboxButton label={t("lightbox.reset")} onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </LightboxButton>
          <LightboxButton label={t("common.close")} onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </LightboxButton>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className={cn(
            "absolute inset-0 touch-none select-none",
            zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={(e) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            if (stateRef.current.zoom > 1) reset();
            else zoomAt(2, e.clientX - rect.left, e.clientY - rect.top);
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            {url ? (
              <img
                src={url}
                alt={item.alt}
                draggable={false}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-sm text-neutral-500">…</div>
            )}
          </div>
        </div>

        {items.length > 1 && (
          <>
            <LightboxNav
              side="left"
              label={t("lightbox.prev")}
              onClick={() => onIndexChange((index - 1 + items.length) % items.length)}
            />
            <LightboxNav
              side="right"
              label={t("lightbox.next")}
              onClick={() => onIndexChange((index + 1) % items.length)}
            />
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-white/10 p-2">
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onIndexChange(i)}
              aria-label={`${it.alt}`}
              aria-current={i === index}
              className={cn(
                "h-14 w-14 shrink-0 overflow-hidden rounded-md border",
                i === index ? "border-primary ring-2 ring-primary" : "border-white/15 opacity-60 hover:opacity-100",
              )}
            >
              <Thumb bucket={it.bucket} path={it.path} alt={it.alt} />
            </button>
          ))}
        </div>
      )}

      {(item.info?.length || renderActions) && (
        <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
          {item.info?.length ? (
            <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-1 text-[11px] sm:grid-cols-3">
              {item.info.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-neutral-500">{row.label}</dt>
                  <dd className="truncate font-medium text-neutral-200" title={row.value}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {renderActions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{renderActions(item)}</div>
          )}
        </div>
      )}

      <p className="px-4 pb-2 text-center text-[11px] text-neutral-500">
        {t("lightbox.hint")}
      </p>
    </div>
  );
}

function Thumb({ bucket, path, alt }: { bucket: string; path: string | null; alt: string }) {
  const url = useSignedUrl(bucket, path, 600);
  if (!url) return <div className="h-full w-full animate-pulse bg-white/10" />;
  return <img src={url} alt={alt} className="h-full w-full object-cover" />;
}

function LightboxButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-white/5 text-neutral-100 transition hover:bg-white/15"
    >
      {children}
    </button>
  );
}

function LightboxNav({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-neutral-100 shadow backdrop-blur transition hover:bg-white/20",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
