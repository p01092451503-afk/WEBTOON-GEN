import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
  head: () => ({
    meta: [
      { title: "toonpilot — Seedream 이미지 생성 SaaS" },
      {
        name: "description",
        content: "캐릭터 라이브러리 기반 Seedream 이미지 생성 워크스페이스.",
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
    if (!loading && user) {
      navigate({ to: "/characters", replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-6 text-center">
        <h1 className="text-5xl font-bold tracking-tight">toonpilot</h1>
        <p className="text-muted-foreground">
          Seedream 4.0 기반 캐릭터 이미지 생성 워크스페이스.
          레퍼런스 · 포즈 · 카메라 · 스타일을 구조화된 프롬프트로 조립합니다.
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild>
            <Link to="/auth">시작하기</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
