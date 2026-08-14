import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "마이페이지 · pilottoon" }] }),
});

const ADVANCED = [
  { to: "/projects", key: "sidebar.projects" },
  { to: "/studio", key: "sidebar.hub" },
  { to: "/video", key: "sidebar.video" },
  { to: "/usage", key: "sidebar.usage" },
] as const;

function AccountPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">{t("nav.account")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("nav.advanced")}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {ADVANCED.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="rounded-2xl border border-border bg-card p-5 text-sm font-semibold shadow-toss-sm transition-colors hover:bg-muted"
          >
            {t(a.key)}
          </Link>
        ))}
      </div>
    </main>
  );
}
