import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Minus, Plus, RefreshCw, Search, ShieldAlert, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { listTenantsAdmin, updateTenantCreditsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "관리자 대시보드 · pilottoon" },
      {
        name: "description",
        content: "테넌트별 크레딧 잔액과 크레딧 기능 사용 여부를 조회하고 조정하는 관리자 전용 대시보드입니다.",
      },
      { property: "og:title", content: "관리자 대시보드 · pilottoon" },
      { property: "og:description", content: "테넌트 크레딧 잔액과 사용 설정을 관리합니다." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type TenantRow = {
  id: string;
  name: string;
  plan: string;
  credit_balance: number;
  credits_enabled: boolean;
  created_at: string;
  member_count: number;
};

function AdminPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchTenants = useServerFn(listTenantsAdmin);
  const saveTenant = useServerFn(updateTenantCreditsAdmin);

  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const roleQ = useQuery({
    queryKey: ["my_role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data?.role ?? "member";
    },
  });
  const isAdmin = roleQ.data === "admin";

  const tenantsQ = useQuery({
    queryKey: ["admin_tenants"],
    enabled: isAdmin,
    queryFn: async () => (await fetchTenants()) as TenantRow[],
  });

  const mut = useMutation({
    mutationFn: (v: { tenantId: string; creditBalance?: number; creditsEnabled?: boolean }) =>
      saveTenant({ data: v }),
    onSuccess: () => {
      toast.success(t("admin.saved", "저장했습니다."));
      qc.invalidateQueries({ queryKey: ["admin_tenants"] });
      qc.invalidateQueries({ queryKey: ["tenant"] });
      qc.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const rows = useMemo(() => {
    const list = tenantsQ.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (r) => r.name.toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle),
    );
  }, [tenantsQ.data, q]);

  const totals = useMemo(() => {
    const list = tenantsQ.data ?? [];
    return {
      tenants: list.length,
      credits: list.reduce((s, r) => s + (r.credit_balance ?? 0), 0),
      enabled: list.filter((r) => r.credits_enabled).length,
    };
  }, [tenantsQ.data]);

  if (roleQ.isLoading) {
    return (
      <main className="mx-auto grid max-w-7xl place-items-center px-5 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <div className="grid place-items-center rounded-3xl border border-border bg-card px-6 py-16 text-center shadow-toss-sm">
          <ShieldAlert className="mb-3 h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-extrabold">{t("admin.forbidden_title", "관리자만 접근할 수 있어요")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.forbidden_desc", "이 페이지는 관리자 권한이 있는 계정에서만 열람할 수 있습니다.")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:py-10">
      <header className="mb-6">
        <p className="text-xs font-bold text-primary">{t("admin.eyebrow", "관리자")}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("admin.title", "테넌트 · 크레딧 관리")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("admin.subtitle", "테넌트별 크레딧 잔액과 크레딧 기능 사용 여부를 조회하고 조정합니다.")}
        </p>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label={t("admin.stat_tenants", "테넌트 수")} value={totals.tenants.toLocaleString()} />
        <StatCard label={t("admin.stat_credits", "총 크레딧 잔액")} value={`${totals.credits.toLocaleString()} CR`} />
        <StatCard label={t("admin.stat_enabled", "크레딧 사용 중")} value={`${totals.enabled} / ${totals.tenants}`} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-3xl bg-card p-3 shadow-toss-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.search", "테넌트 이름 또는 ID 검색")}
            className="h-10 rounded-full pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => tenantsQ.refetch()}
          disabled={tenantsQ.isFetching}
          className="h-10 rounded-full text-xs font-semibold"
        >
          <RefreshCw className={"mr-1.5 h-3.5 w-3.5 " + (tenantsQ.isFetching ? "animate-spin" : "")} />
          {t("common.refresh", "새로고침")}
        </Button>
      </div>

      {tenantsQ.isError && (
        <p className="mb-4 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
          {(tenantsQ.error as Error).message}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((r) => {
          const draft = drafts[r.id] ?? String(r.credit_balance);
          const parsed = Number(draft);
          const dirty = Number.isFinite(parsed) && parsed !== r.credit_balance;
          const busy = mut.isPending && mut.variables?.tenantId === r.id;
          return (
            <section key={r.id} className="rounded-3xl bg-card p-4 shadow-toss-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold">{r.name}</h2>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{r.id}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      {t("admin.plan", "플랜")}: {r.plan}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      {t("admin.members", "멤버")}: {r.member_count}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                      <Wallet className="mr-1 inline h-3 w-3" />
                      {r.credit_balance.toLocaleString()} CR
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  {t("admin.credits_enabled", "크레딧 기능")}
                  <Switch
                    checked={r.credits_enabled}
                    disabled={busy}
                    onCheckedChange={(v) => mut.mutate({ tenantId: r.id, creditsEnabled: v })}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <StepButton
                  icon={<Minus className="h-3.5 w-3.5" />}
                  label={t("admin.minus", "1,000 차감")}
                  onClick={() =>
                    setDrafts((p) => ({ ...p, [r.id]: String(Math.max(0, (Number(draft) || 0) - 1000)) }))
                  }
                />
                <Input
                  value={draft}
                  inputMode="numeric"
                  onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: e.target.value.replace(/[^0-9]/g, "") }))}
                  className="h-9 w-36 rounded-xl text-center font-mono text-sm"
                  aria-label={t("admin.credit_balance", "크레딧 잔액")}
                />
                <StepButton
                  icon={<Plus className="h-3.5 w-3.5" />}
                  label={t("admin.plus", "1,000 충전")}
                  onClick={() => setDrafts((p) => ({ ...p, [r.id]: String((Number(draft) || 0) + 1000) }))}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!dirty || busy}
                  onClick={() => mut.mutate({ tenantId: r.id, creditBalance: parsed })}
                  className="h-9 rounded-full text-xs font-bold"
                >
                  {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  {t("common.save", "저장")}
                </Button>
                {dirty && (
                  <button
                    type="button"
                    onClick={() => setDrafts((p) => ({ ...p, [r.id]: String(r.credit_balance) }))}
                    className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {t("common.reset", "되돌리기")}
                  </button>
                )}
              </div>
            </section>
          );
        })}

        {!tenantsQ.isLoading && rows.length === 0 && (
          <div className="grid place-items-center rounded-3xl border border-dashed border-border px-6 py-16 text-center">
            <p className="text-sm font-semibold">{t("admin.empty", "표시할 테넌트가 없습니다.")}</p>
          </div>
        )}

        {tenantsQ.isLoading && (
          <div className="grid place-items-center rounded-3xl border border-dashed border-border px-6 py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-toss-sm">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

function StepButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-foreground transition hover:bg-primary/10 hover:text-primary"
    >
      {icon}
    </button>
  );
}
