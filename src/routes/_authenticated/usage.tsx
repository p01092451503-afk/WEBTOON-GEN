import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/usage")({
  ssr: false,
  component: UsagePage,
  head: () => ({
    meta: [
      { title: "API usage · pilottoon" },
      { name: "description", content: "Estimated Seedream image generation API usage and cost by month and size." },
      { property: "og:title", content: "API usage · pilottoon" },
      { property: "og:description", content: "Estimated image generation API usage and cost." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

// BytePlus ARK Seedream image pricing (USD per generated image), by requested size.
const PRICE_BY_SIZE: Record<string, number> = {
  "1K": 0.03,
  "2K": 0.03,
  "4K": 0.06,
};
const DEFAULT_PRICE = 0.03;
// Rough stored bytes per image (PNG/JPEG output), used for the storage estimate.
const BYTES_BY_SIZE: Record<string, number> = {
  "1K": 1.2 * 1024 * 1024,
  "2K": 3.0 * 1024 * 1024,
  "4K": 9.0 * 1024 * 1024,
};
const DEFAULT_BYTES = 1.5 * 1024 * 1024;
const STORAGE_PRICE_PER_GB_MONTH = 0.021;

type Row = {
  id: string;
  status: string;
  api_size: string | null;
  api_model: string | null;
  batch_count: number;
  created_at: string;
};

function usd(n: number) {
  return `$${n.toFixed(n < 1 && n > 0 ? 4 : 2)}`;
}

function sizeKey(size: string | null) {
  if (!size) return "1K";
  const s = size.toUpperCase();
  if (s.includes("4K")) return "4K";
  if (s.includes("2K")) return "2K";
  if (s.includes("1K")) return "1K";
  return s;
}

function UsagePage() {
  const { t, i18n } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [rows, setRows] = useState<Row[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: gens }, { count }] = await Promise.all([
        supabase
          .from("generations")
          .select("id, status, api_size, api_model, batch_count, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("usage_events")
          .select("image_count", { count: "exact", head: false })
          .eq("tenant_id", tenantId),
      ] as const);
      if (cancelled) return;
      setRows((gens ?? []) as Row[]);
      setImageCount(count ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, reloadKey]);

  const stats = useMemo(() => {
    const done = rows.filter((r) => r.status === "done" || r.status === "completed" || r.status === "succeeded");
    const total = rows.length;

    let images = 0;
    let cost = 0;
    let bytes = 0;
    const byMonth = new Map<string, { images: number; cost: number }>();
    const bySize = new Map<string, { images: number; cost: number }>();
    const byModel = new Map<string, { images: number; cost: number }>();
    const monthNow = new Date().toISOString().slice(0, 7);
    let monthCost = 0;

    for (const r of done) {
      const key = sizeKey(r.api_size);
      const n = Math.max(1, r.batch_count || 1);
      const price = (PRICE_BY_SIZE[key] ?? DEFAULT_PRICE) * n;
      const size = (BYTES_BY_SIZE[key] ?? DEFAULT_BYTES) * n;
      images += n;
      cost += price;
      bytes += size;

      const m = r.created_at.slice(0, 7);
      if (m === monthNow) monthCost += price;
      const mm = byMonth.get(m) ?? { images: 0, cost: 0 };
      byMonth.set(m, { images: mm.images + n, cost: mm.cost + price });
      const ss = bySize.get(key) ?? { images: 0, cost: 0 };
      bySize.set(key, { images: ss.images + n, cost: ss.cost + price });
      const modelKey = r.api_model || "-";
      const mo = byModel.get(modelKey) ?? { images: 0, cost: 0 };
      byModel.set(modelKey, { images: mo.images + n, cost: mo.cost + price });
    }

    const gb = bytes / (1024 * 1024 * 1024);
    return {
      total,
      success: done.length,
      images,
      cost,
      monthCost,
      gb,
      storageCost: gb * STORAGE_PRICE_PER_GB_MONTH,
      byMonth: [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])),
      bySize: [...bySize.entries()].sort((a, b) => b[1].cost - a[1].cost),
      byModel: [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost),
    };
  }, [rows]);

  const busy = loading || tenantLoading;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <Wallet className="h-6 w-6 text-primary" aria-hidden="true" />
            {t("usage.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("usage.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={busy}
        >
          <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {t("usage.refresh")}
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={t("usage.month_cost")} value={usd(stats.monthCost)} />
        <StatCard label={t("usage.total_cost")} value={usd(stats.cost)} />
        <StatCard
          label={t("usage.success_ratio")}
          value={`${stats.success} / ${stats.total}`}
          hint={t("usage.images_count", { count: stats.images })}
        />
      </div>

      <Panel title={t("usage.by_month")}>
        {stats.byMonth.length === 0 ? (
          <Empty text={t("usage.empty")} />
        ) : (
          stats.byMonth.map(([m, v]) => (
            <RowLine key={m} left={m} right={`${v.images} · ${usd(v.cost)}`} />
          ))
        )}
      </Panel>

      <Panel title={t("usage.by_size")}>
        {stats.bySize.length === 0 ? (
          <Empty text={t("usage.empty")} />
        ) : (
          stats.bySize.map(([s, v]) => (
            <RowLine key={s} left={s} right={`${v.images} · ${usd(v.cost)}`} />
          ))
        )}
      </Panel>

      <Panel title={t("usage.by_model")}>
        {stats.byModel.length === 0 ? (
          <Empty text={t("usage.empty")} />
        ) : (
          stats.byModel.map(([s, v]) => (
            <RowLine key={s} left={s} right={`${v.images} · ${usd(v.cost)}`} />
          ))
        )}
      </Panel>

      <Panel title={t("usage.other_cost")}>
        <RowLine
          left={t("usage.storage")}
          sub={t("usage.storage_sub", { gb: stats.gb.toFixed(2) })}
          right={usd(stats.storageCost)}
        />
        <RowLine left={t("usage.gateway")} sub={t("usage.gateway_sub")} right={t("usage.not_used")} />
        <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-sm font-bold">
          <span>{t("usage.month_total")}</span>
          <span className="text-primary">{usd(stats.monthCost + stats.storageCost)}</span>
        </div>
      </Panel>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        {t("usage.disclaimer")}
        <br />
        {t("usage.rate_note")}
      </p>

      {imageCount > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("usage.events_note", { count: imageCount })} ·{" "}
          {new Date().toLocaleString(i18n.language === "ko" ? "ko-KR" : "en-US")}
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-toss-sm">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-toss-sm">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-3 space-y-1">{children}</div>
    </section>
  );
}

function RowLine({ left, right, sub }: { left: string; right: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-sm text-muted-foreground">{left}</div>
        {sub && <div className="truncate text-xs text-muted-foreground/80">{sub}</div>}
      </div>
      <div className="shrink-0 text-sm font-bold">{right}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm text-muted-foreground">{text}</div>;
}
