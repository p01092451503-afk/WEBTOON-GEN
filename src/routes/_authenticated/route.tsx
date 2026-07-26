import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapTenant } from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";

// 통합 관리형 게이트 파일이 프로젝트에 없어 직접 생성 (Supabase 세션은 localStorage 기반이라 ssr: false).
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "onboarding" | "ready" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bootstrap = useServerFn(bootstrapTenant);

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
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        <div className="text-sm">
          {status === "checking" ? "세션 확인 중…" : "워크스페이스 준비 중…"}
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-lg font-semibold">온보딩 실패</h2>
          <p className="text-sm text-muted-foreground break-all">{errorMsg}</p>
          <Button onClick={handleSignOut} variant="outline">로그아웃</Button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="font-semibold tracking-tight">toonpilot</div>
          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/characters" })}
            >
              캐릭터
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              로그아웃
            </Button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
