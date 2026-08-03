import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Library, LayoutGrid, History } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";


export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
  head: () => ({
    meta: [
      { title: "toonpilot — Character-driven image generation workspace" },
      {
        name: "description",
        content: "Assemble Seedream images with a reusable character library and a structured prompt engine.",
      },
      { property: "og:title", content: "toonpilot" },
      { property: "og:description", content: "Character-based Seedream image generation SaaS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/studio", replace: true });
  }, [user, loading, navigate]);

  return (
    <main className="min-h-screen bg-background">
      <div className="absolute right-5 top-5">
        <LanguageToggle />
      </div>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold tracking-wide text-foreground/80">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          {t("landing.badge")}
        </span>
        <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
          {t("landing.headline_1")}
          <br />
          {t("landing.headline_2")}<span className="text-primary">{t("brand.name")}</span>.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t("landing.subtitle")}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-12 rounded-full px-8 text-base font-semibold shadow-toss">
            <Link to="/auth">{t("landing.get_started")}</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-6 text-base font-semibold">
            <Link to="/auth">{t("landing.sign_in")}</Link>
          </Button>
        </div>

        <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureCard
            index="01"
            icon={<ImageIcon className="h-4 w-4" strokeWidth={1.75} />}
            title={t("landing.feature_image")}
            body={t("landing.feature_image_body")}
          />
          <FeatureCard
            index="02"
            icon={<Film className="h-4 w-4" strokeWidth={1.75} />}
            title={t("landing.feature_video")}
            body={t("landing.feature_video_body")}
          />
          <FeatureCard
            index="03"
            icon={<History className="h-4 w-4" strokeWidth={1.75} />}
            title={t("landing.feature_history")}
            body={t("landing.feature_history_body")}
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ index, icon, title, body }: { index: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group relative rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {icon}
          {index}
        </span>
        <span className="h-px w-8 bg-border" />
      </div>
      <div className="mt-6 text-sm font-bold text-foreground">{title}</div>
      <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</div>
    </div>
  );
}
