import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Images, History, Sparkles } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { TopNav } from "@/components/top-nav";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/home")({
  ssr: false,
  component: HomePage,
  head: () => ({
    meta: [
      { title: "홈 — webtoon-gen AI 웹툰 이미지 생성 서비스" },
      {
        name: "description",
        content: "웹툰 이미지 생성 워크스페이스 홈. 만들기·이미지 그룹·히스토리로 바로 이동하세요.",
      },
      { property: "og:title", content: "홈 — webtoon-gen" },
      { property: "og:description", content: "AI 웹툰 이미지 생성 서비스 홈" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <TopNav />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <section className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-border bg-card px-6 py-20 text-center shadow-toss">
          <p className="text-sm font-medium text-muted-foreground">
            {t("home.kicker", "AI 웹툰 이미지 생성 서비스")}
          </p>
          <h1 className="mt-3 text-5xl font-black tracking-tight text-foreground sm:text-6xl">
            {t("brand.name")}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("home.sub", "레퍼런스를 올리고 프롬프트만 적으면, 캐릭터 일관성을 지킨 이미지를 바로 만들 수 있어요.")}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full px-7 text-base font-semibold shadow-toss">
              <Link to={user ? "/generate" : "/auth"}>
                <ImageIcon className="mr-2 h-4 w-4" strokeWidth={2} />
                {t("home.cta", "이미지 만들기")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-6 text-base font-semibold">
              <Link to="/">{t("home.about", "서비스 소개")}</Link>
            </Button>
          </div>

          <div className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            <QuickCard to={user ? "/generate" : "/auth"} icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />} label={t("nav.create")} />
            <QuickCard to={user ? "/groups" : "/auth"} icon={<Images className="h-4 w-4" strokeWidth={1.75} />} label={t("nav.groups")} />
            <QuickCard to={user ? "/history" : "/auth"} icon={<History className="h-4 w-4" strokeWidth={1.75} />} label={t("nav.history")} />
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background py-6">
        <p className="px-4 text-center text-xs text-muted-foreground">
          {t("footer.terms", "이용약관")} · {t("footer.privacy", "개인정보처리방침")} · © 2026 STUDIO 0103 Co., Ltd. &amp; CHILBOK Corp.
        </p>
      </footer>
    </div>
  );
}

function QuickCard({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </Link>
  );
}
