import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Users, Sparkles, History, LogOut, FolderKanban } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export function AppSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const items = [
    { title: t("sidebar.projects"), url: "/projects", icon: FolderKanban, desc: t("sidebar.projects_desc") },
    { title: t("sidebar.characters"), url: "/characters", icon: Users, desc: t("sidebar.characters_desc") },
    { title: t("sidebar.studio"), url: "/generate", icon: Sparkles, desc: t("sidebar.studio_desc") },
    { title: t("sidebar.history"), url: "/history", icon: History, desc: t("sidebar.history_desc") },
  ] as const;

  async function handleSignOut() {
    if (typeof window !== "undefined") sessionStorage.setItem("toonpilot:signedOut", "1");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center px-2 py-2.5">
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold tracking-tight">{t("brand.name")}</div>
              <div className="truncate text-[11px] font-medium text-muted-foreground">
                {t("brand.tagline")}
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("sidebar.workspace")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="h-11 rounded-xl data-[active=true]:bg-primary-soft data-[active=true]:text-primary data-[active=true]:font-semibold"
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />
                        {!collapsed && (
                          <span className="flex min-w-0 flex-col leading-tight">
                            <span className="truncate text-sm font-semibold">{item.title}</span>
                            <span className="truncate text-[11px] font-normal text-muted-foreground">
                              {item.desc}
                            </span>
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip={t("common.sign_out")}
              className="h-10 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" strokeWidth={2.2} />
              {!collapsed && <span className="text-sm font-medium">{t("common.sign_out")}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
