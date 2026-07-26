import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "로그인 · toonpilot" },
      { name: "description", content: "toonpilot 로그인 또는 회원가입" },
      { property: "og:title", content: "toonpilot 로그인" },
      { property: "og:description", content: "toonpilot 로그인 또는 회원가입" },
    ],
  }),
});

const DEV_EMAIL = "test@test.co.kr";
const DEV_PASSWORD = "test1111";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [loading, setLoading] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  async function submit(currentMode: "signin" | "signup", em: string, pw: string) {
    setLoading(true);
    try {
      if (currentMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: em,
          password: pw,
          options: { emailRedirectTo: `${window.location.origin}/characters` },
        });
        if (error) throw error;
        toast.success("가입 완료. 로그인 중…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
        if (error) throw error;
      }
      navigate({ to: "/characters", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit(mode, email, password);
  }

  useEffect(() => {
    if (autoTried) return;
    setAutoTried(true);
    if (typeof window !== "undefined" && sessionStorage.getItem("toonpilot:signedOut") === "1") {
      sessionStorage.removeItem("toonpilot:signedOut");
      return;
    }
    void submit("signin", DEV_EMAIL, DEV_PASSWORD);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-toss">
            t
          </div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-foreground">
            toonpilot에 오신 걸 환영해요
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin" ? "이메일로 로그인" : "새 계정 만들기"}
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-toss">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            <TabButton active={mode === "signin"} onClick={() => setMode("signin")}>
              로그인
            </TabButton>
            <TabButton active={mode === "signup"} onClick={() => setMode("signup")}>
              회원가입
            </TabButton>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="이메일">
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-border bg-muted/50 px-4 text-[15px] focus-visible:bg-card"
              />
            </Field>
            <Field label="비밀번호">
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl border-border bg-muted/50 px-4 text-[15px] focus-visible:bg-card"
              />
            </Field>

            <Button
              type="submit"
              disabled={loading}
              className="h-13 w-full rounded-xl bg-primary py-3 text-[15px] font-bold text-primary-foreground shadow-toss hover:bg-primary/90"
              style={{ height: "52px" }}
            >
              {loading ? "처리 중…" : mode === "signup" ? "가입하고 시작하기" : "로그인"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          계속 진행하면 서비스 약관에 동의한 것으로 간주됩니다.
        </p>
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg px-3 py-2 text-sm font-semibold transition " +
        (active
          ? "bg-card text-foreground shadow-toss-sm"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
