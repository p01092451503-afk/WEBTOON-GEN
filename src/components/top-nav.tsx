import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Home, Sparkles, Images, History, LifeBuoy, LogOut, Menu, User as UserIcon, Coins } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useCredits } from "@/hooks/useCredits";
import { formatCredits } from "@/lib/credits";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/home", key: "nav.home", icon: Home, exact: true },
  { to: "/generate", key: "nav.create", icon: Sparkles },
  { to: "/groups", key: "nav.groups", icon: Images },
  { to: "/history", key: "nav.history", icon: History },
] as const;

export function TopNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { enabled: creditsEnabled, balance, loading: creditsLoading } = useCredits();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [openMobile, setOpenMobile] = useState(false);

  const email = user?.email ?? "";
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-2 px-4 sm:px-6">
        <Link to="/" className="mr-1 flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
          <span className="text-xl font-black tracking-tighter text-foreground">
            {t("brand.name")}
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = isActive(item.to, (item as { exact?: boolean }).exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-card font-semibold text-foreground shadow-toss-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} strokeWidth={2} />
                <span className="hidden lg:inline">{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
          {tenantId && creditsEnabled && (
            <Link
              to="/usage"
              title={t("credits.balance_title", "남은 크레딧")}
              className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted sm:inline-flex"
            >
              <Coins className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
              {creditsLoading ? "…" : `${formatCredits(balance)} CR`}
            </Link>
          )}

          <Link
            to="/support"
            className="hidden h-9 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
          >
            <LifeBuoy className="mr-1.5 h-4 w-4" strokeWidth={2} />
            {t("nav.support")}
          </Link>

          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label={email || "user menu"}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {(email?.[0] || "U").toUpperCase()}
                  </span>
                  <span className="hidden max-w-[140px] truncate text-xs font-semibold sm:inline">
                    {email ? email.split("@")[0] : "user"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5">
                <DropdownMenuLabel className="px-2 py-2">
                  <div className="truncate text-sm font-semibold">{email || "user"}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="rounded-xl px-2.5 py-2 text-sm" onSelect={() => navigate({ to: "/account" })}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  {t("nav.account")}
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl px-2.5 py-2 text-sm" onSelect={() => navigate({ to: "/projects" })}>
                  {t("sidebar.projects")}
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl px-2.5 py-2 text-sm" onSelect={() => navigate({ to: "/studio" })}>
                  {t("sidebar.hub")}
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl px-2.5 py-2 text-sm" onSelect={() => navigate({ to: "/video" })}>
                  {t("sidebar.video")}
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl px-2.5 py-2 text-sm" onSelect={() => navigate({ to: "/usage" })}>
                  {t("sidebar.usage")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="rounded-xl px-2.5 py-2 text-sm text-destructive focus:text-destructive"
                  onSelect={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("common.sign_out")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild className="h-9 rounded-full px-4 text-sm font-semibold shadow-toss">
              <Link to="/auth">{t("nav.sign_in")}</Link>
            </Button>
          )}

          <button
            type="button"
            aria-label="menu"
            onClick={() => setOpenMobile((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {openMobile && (
        <nav className="grid gap-1 border-t border-border bg-background px-4 pb-3 pt-2 md:hidden">
          {[...NAV, { to: "/support", key: "nav.support", icon: LifeBuoy }].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpenMobile(false)}
              className="inline-flex h-11 items-center gap-2 rounded-2xl px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <item.icon className="h-4 w-4" strokeWidth={2} />
              {t(item.key)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
