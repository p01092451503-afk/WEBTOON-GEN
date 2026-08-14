import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { TopNav } from "@/components/top-nav";

export const Route = createFileRoute("/support")({
  ssr: false,
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "고객센터 · pilottoon" },
      { name: "description", content: "pilottoon 사용 중 궁금한 점과 문의를 해결하세요." },
      { property: "og:title", content: "고객센터 · pilottoon" },
      { property: "og:description", content: "pilottoon 사용 중 궁금한 점과 문의를 해결하세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function SupportPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-muted/40">
      <TopNav />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("nav.support")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("common.please_wait")}</p>
      </main>
    </div>
  );
}
