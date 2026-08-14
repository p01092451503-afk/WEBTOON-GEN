import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useCredits } from "@/hooks/useCredits";
import { useMyTickets } from "@/hooks/useSupport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Film,
  FolderKanban,
  Landmark,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Receipt,
  User as UserIcon,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  ssr: false,
  component: AccountPage,
  head: () => ({
    meta: [
      { title: "마이페이지 · webtoon-gen" },
      { name: "description", content: "회원정보, 문의 내역, 크레딧 사용 내역과 고급 도구를 한 곳에서 관리하세요." },
      { property: "og:title", content: "마이페이지 · webtoon-gen" },
      { property: "og:description", content: "회원정보, 문의 내역, 크레딧 사용 내역 관리." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Section = "profile" | "tickets" | "credits" | "payments" | "refund";

const ADVANCED = [
  { to: "/projects", key: "sidebar.projects", fallback: "프로젝트", icon: FolderKanban },
  { to: "/studio", key: "sidebar.hub", fallback: "스튜디오 허브", icon: LayoutGrid },
  { to: "/video", key: "sidebar.video", fallback: "비디오", icon: Film },
  { to: "/usage", key: "sidebar.usage", fallback: "API 사용량", icon: Receipt },
] as const;

function useCreditHistory(tenantId: string | null) {
  return useQuery({
    queryKey: ["usage_events", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usage_events")
        .select("id, created_at, image_count, credit_cost, generation_id")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function AccountPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const credits = useCredits();
  const tickets = useMyTickets();
  const history = useCreditHistory(tenantId);
  const [section, setSection] = useState<Section>("profile");

  const MENU: { key: Section; label: string; icon: typeof UserIcon }[] = useMemo(
    () => [
      { key: "profile", label: t("account.menu.profile", "회원정보"), icon: UserIcon },
      { key: "tickets", label: t("account.menu.tickets", "1:1 문의 내역"), icon: MessageSquare },
      { key: "credits", label: t("account.menu.credits", "크레딧 사용 내역"), icon: Wallet },
      { key: "payments", label: t("account.menu.payments", "결제·취소 내역"), icon: CreditCard },
      { key: "refund", label: t("account.menu.refund", "환불계좌"), icon: Landmark },
    ],
    [t],
  );

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("nav.account", "마이페이지")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="space-y-3">
          <nav className="rounded-2xl border border-border bg-card p-2 shadow-toss-sm">
            {MENU.map((m) => {
              const Icon = m.icon;
              const active = section === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSection(m.key)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {m.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              {t("account.menu.sign_out", "로그아웃")}
            </button>
          </nav>

          <div className="rounded-2xl border border-border bg-card p-3 shadow-toss-sm">
            <p className="px-1 pb-2 text-xs font-bold text-muted-foreground">{t("nav.advanced", "고급 기능 바로가기")}</p>
            {ADVANCED.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.to}
                  to={a.to}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
                >
                  <Icon className="h-4 w-4" />
                  {t(a.key, a.fallback)}
                </Link>
              );
            })}
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-toss-sm">
          {section === "profile" && (
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted-foreground">{t("account.email", "이메일")}</dt>
                <dd className="font-semibold">{user?.email ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted-foreground">{t("account.joined", "가입일")}</dt>
                <dd className="font-semibold">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
                </dd>
              </div>
              {credits.enabled && (
                <div className="flex justify-between gap-4 border-b border-border pb-3">
                  <dt className="text-muted-foreground">{t("credits.balance_title", "남은 크레딧")}</dt>
                  <dd className="font-semibold text-primary">{credits.balance ?? 0} CR</dd>
                </div>
              )}
            </dl>
          )}

          {section === "tickets" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">{t("account.menu.tickets", "1:1 문의 내역")}</h2>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link to="/support">{t("account.new_ticket", "새 문의 등록")}</Link>
                </Button>
              </div>
              {(tickets.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("account.no_tickets", "문의 내역이 없습니다.")}</p>
              ) : (
                <ul className="space-y-2">
                  {(tickets.data ?? []).map((tk) => (
                    <li key={tk.id} className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant={tk.status === "open" ? "secondary" : "default"}>
                          {tk.status === "open" ? t("account.status_open", "접수됨") : t("account.status_done", "답변완료")}
                        </Badge>
                        <span className="font-semibold">{tk.title}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {new Date(tk.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{tk.body}</p>
                      {tk.admin_reply && (
                        <p className="mt-3 rounded-xl bg-muted p-3 text-sm">
                          <span className="font-semibold">{t("account.reply", "답변")}: </span>
                          {tk.admin_reply}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {section === "credits" && (
            <div className="space-y-3">
              {credits.enabled && (
                <p className="text-sm text-muted-foreground">
                  {t("credits.balance_title", "남은 크레딧")}:{" "}
                  <span className="font-bold text-primary">{credits.balance ?? 0} CR</span>
                </p>
              )}
              {(history.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("account.no_usage", "사용 내역이 없습니다.")}</p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border bg-background">
                  {(history.data ?? []).map((row) => (
                    <li key={row.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <span className="text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
                      <span className="ml-auto">
                        {t("account.images_n", "이미지 {{n}}장", { n: row.image_count })}
                      </span>
                      <span className="w-20 text-right font-semibold text-primary">-{row.credit_cost ?? 0} CR</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {section === "payments" && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {t("account.payments_soon", "결제·취소 내역은 결제 기능 오픈 후 제공될 예정입니다.")}
              </p>
            </div>
          )}

          {section === "refund" && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <Landmark className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {t("account.refund_soon", "환불계좌 등록은 결제 기능 오픈 후 제공됩니다. 그전에는 1:1 문의로 요청해 주세요.")}
              </p>
              <Button asChild variant="outline" className="mt-4 rounded-full">
                <Link to="/support">{t("nav.support", "고객센터")}</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
