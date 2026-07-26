import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapTenant } from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

const NAV: { to: "/characters" | "/generate" | "/history"; label: string }[] = [
  { to: "/characters", label: "캐릭터" },
  { to: "/generate", label: "생성" },
  { to: "/history", label: "히스토리" },
];

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "onboarding" | "ready" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bootstrap = useServerFn(bootstrapTenant);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 sm:flex sm:flex-wrap sm:justify-between">
          <button
            onClick={() => navigate({ to: "/characters" })}
            className="flex min-w-0 items-center gap-2"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
              t
            </span>
            <span className="truncate text-base font-extrabold tracking-tight">toonpilot</span>
          </button>
          <nav className="flex items-center gap-1 rounded-full bg-muted p-1">
            {NAV.map((n) => {
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <button
                  key={n.to}
                  onClick={() => navigate({ to: n.to })}
                  className={
                    "rounded-full px-3.5 py-1.5 text-sm font-semibold transition " +
                    (active
                      ? "bg-card text-foreground shadow-toss-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {n.label}
                </button>
              );
            })}
            <button
              onClick={handleSignOut}
              className="ml-1 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              로그아웃
            </button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
