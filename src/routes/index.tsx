import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "toonpilot — Seedream 이미지 생성 SaaS" },
      { name: "description", content: "캐릭터 라이브러리 기반 Seedream 이미지 생성 SaaS. 곧 UI가 공개됩니다." },
      { property: "og:title", content: "toonpilot" },
      { property: "og:description", content: "캐릭터 기반 Seedream 이미지 생성 SaaS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">toonpilot</h1>
        <p className="text-muted-foreground">
          Seedream 기반 캐릭터 이미지 생성 SaaS. 백엔드(DB · Storage · 프롬프트 엔진 · Edge Function)
          구축이 진행 중이며, 사용자 UI는 다음 단계(P6)에서 만들어집니다.
        </p>
        <ul className="text-sm space-y-2 border rounded-lg p-4 bg-card">
          <li>✅ P2 스키마 · RLS</li>
          <li>✅ P3 비공개 스토리지 버킷</li>
          <li>✅ P4 프롬프트 엔진 (src/lib/promptEngine.ts)</li>
          <li>⏳ P5 Edge Function <code>generate</code></li>
          <li>⏳ P6 캐릭터/생성 UI</li>
        </ul>
      </div>
    </main>
  );
}
