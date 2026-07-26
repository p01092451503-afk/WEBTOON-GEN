import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapTenant } from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Bell, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

const PAGE_META: Record<string, { title: string; sub: string }> = {
  "/characters": { title: "캐릭터 라이브러리", sub: "생성에 사용할 캐릭터를 관리하세요" },
  "/generate": { title: "이미지 생성", sub: "Studio · Seedream 프롬프트 엔진" },
  "/history": { title: "히스토리", sub: "최근 생성 결과 및 옵션" },
};

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "onboarding" | "ready" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const bootstrap = useServerFn(bootstrapTenant);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const meta = useMemo(() => {
    const key = Object.keys(PAGE_META).find((k) => pathname === k || pathname.startsWith(k + "/"));
    return key ? PAGE_META[key] : { title: "toonpilot", sub: "" };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setEmail(data.user.email ?? "");
      setStatus("onboarding");
      try {
        await bootstrap();
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, bootstrap]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (status === "checking" || status === "onboarding") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-primary-soft" />
          {status === "checking" ? "세션 확인 중…" : "워크스페이스 준비 중…"}
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 rounded-3xl border border-border bg-card p-8 text-center shadow-toss">
          <h2 className="text-lg font-bold">온보딩에 실패했어요</h2>
          <p className="break-all text-sm text-muted-foreground">{errorMsg}</p>
          <Button onClick={handleSignOut} variant="outline" className="rounded-xl">
            로그아웃
          </Button>
        </div>
      </main>
    );
  }

  const initials = (email.split("@")[0] || "U").slice(0, 2).toUpperCase();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/40 text-foreground">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
            <SidebarTrigger className="h-9 w-9 rounded-lg hover:bg-muted" />
            <div className="hidden h-6 w-px bg-border sm:block" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold tracking-tight">{meta.title}</div>
              {meta.sub && (
                <div className="truncate text-xs text-muted-foreground">{meta.sub}</div>
              )}
            </div>

            <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground md:flex">
              <Search className="h-4 w-4" />
              <span className="text-xs">검색…</span>
              <kbd className="ml-3 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">⌘K</kbd>
            </div>

            <button
              className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="알림"
            >
              <Bell className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
                {initials}
              </span>
              <span className="hidden max-w-[140px] truncate text-xs font-semibold text-foreground sm:inline">
                {email || "user"}
              </span>
            </div>
          </header>

          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
