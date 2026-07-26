import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles, Users, Wand2 } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
  head: () => ({
    meta: [
      { title: "toonpilot — 캐릭터 기반 이미지 생성 워크스페이스" },
      {
        name: "description",
        content: "캐릭터 라이브러리와 구조화된 프롬프트로 Seedream 이미지를 조립하는 워크스페이스.",
      },
      { property: "og:title", content: "toonpilot" },
      { property: "og:description", content: "캐릭터 기반 Seedream 이미지 생성 SaaS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/characters", replace: true });
  }, [user, loading, navigate]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Seedream 4.0 · Beta
        </span>
        <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
          캐릭터부터 컷까지,
          <br />
          <span className="text-primary">toonpilot</span> 하나로.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          레퍼런스 · 포즈 · 카메라 · 스타일을 구조화된 프롬프트로 조립하는
          가장 쉬운 방법. 결과는 자동으로 히스토리에 저장돼요.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-12 rounded-full px-8 text-base font-semibold shadow-toss">
            <Link to="/auth">시작하기</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-6 text-base font-semibold">
            <Link to="/auth">로그인</Link>
          </Button>
        </div>

        <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<Users className="h-5 w-5" />}
            title="캐릭터 라이브러리"
            body="한 번 등록한 캐릭터를 어디서든 재사용"
          />
          <FeatureCard
            icon={<Wand2 className="h-5 w-5" />}
            title="4패널 컨트롤"
            body="레퍼런스·프롬프트·피규어·최종"
          />
          <FeatureCard
            icon={<Sparkles className="h-5 w-5" />}
            title="자동 히스토리"
            body="옵션 복원으로 즉시 재생성"
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-left shadow-toss-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
        {icon}
      </div>
      <div className="mt-3 text-sm font-bold text-foreground">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</div>
    </div>
  );
}
