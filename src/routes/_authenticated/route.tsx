import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapTenant } from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/top-nav";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

// Session + tenant bootstrap only needs to happen once per browser session.
// Caching it prevents a full-screen loading flash (and state loss) whenever the
// layout remounts — e.g. after a router invalidation triggered by Supabase auth events.
let bootstrapCache: { email: string } | null = null;

function AuthenticatedLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "onboarding" | "ready" | "error">(
    bootstrapCache ? "ready" : "checking",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [email, setEmail] = useState<string>(bootstrapCache?.email ?? "");
  const bootstrap = useServerFn(bootstrapTenant);

  useEffect(() => {
    if (bootstrapCache) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const userEmail = data.user.email ?? "";
      if (!cancelled) {
        setEmail(userEmail);
        setStatus("onboarding");
      }
      try {
        await bootstrap();
        bootstrapCache = { email: userEmail };
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
    bootstrapCache = null;
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }


  if (status === "checking" || status === "onboarding") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-primary-soft" />
          {status === "checking" ? t("auth.checking_session") : t("auth.preparing_workspace")}
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 rounded-3xl border border-border bg-card p-8 text-center shadow-toss">
          <h2 className="text-lg font-bold">{t("auth.onboarding_failed")}</h2>
          <p className="break-all text-sm text-muted-foreground">{errorMsg}</p>
          <Button onClick={handleSignOut} variant="outline" className="rounded-xl">
            {t("common.sign_out")}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 text-foreground">
      <TopNav />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
