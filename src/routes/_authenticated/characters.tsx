import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/characters")({
  component: CharactersPage,
  head: () => ({ meta: [{ title: "캐릭터 라이브러리 · toonpilot" }] }),
});

function CharactersPage() {
  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">캐릭터 라이브러리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          로그인 · 온보딩이 완료되었습니다. 다음 단계(P7)에서 캐릭터 생성/업로드 UI를 추가합니다.
        </p>
      </div>
      <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
        아직 캐릭터가 없습니다.
      </div>
    </main>
  );
}
