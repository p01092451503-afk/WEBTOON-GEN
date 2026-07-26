import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Compass, Folder, Users, Image as ImageIcon, Wand2, History as HistoryIcon, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type ProjectRow = { id: string; title: string };
type CharacterRow = { id: string; display_name: string };
type EpisodeRow = { id: string; title: string; project_id: string };

interface Props {
  trigger?: React.ReactNode;
}

export function GlobalSearch({ trigger }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load data when opening
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [p, c, e] = await Promise.all([
        supabase.from("projects").select("id,title").order("created_at", { ascending: false }).limit(50),
        supabase.from("characters").select("id,display_name").order("created_at", { ascending: false }).limit(50),
        supabase.from("episodes").select("id,title,project_id").order("created_at", { ascending: false }).limit(50),
      ]);
      if (cancelled) return;
      setProjects((p.data as ProjectRow[] | null) ?? []);
      setCharacters((c.data as CharacterRow[] | null) ?? []);
      setEpisodes((e.data as EpisodeRow[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function go(to: string) {
    setOpen(false);
    setQuery("");
    navigate({ to });
  }

  return (
    <>
      {trigger ? (
        <button type="button" onClick={() => setOpen(true)} className="contents">
          {trigger}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("common.search_placeholder")}
          className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted md:flex"
        >
          <Search className="h-4 w-4" />
          <span className="text-xs">{t("common.search_placeholder")}</span>
          <kbd className="ml-3 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">⌘K</kbd>
        </button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("common.search_placeholder")}
        />
        <CommandList>
          <CommandEmpty>{t("common.no_results", { defaultValue: "No results." })}</CommandEmpty>

          <CommandGroup heading={t("nav.title", { defaultValue: "Navigation" })}>
            <CommandItem onSelect={() => go("/projects")}>
              <Folder className="mr-2 h-4 w-4" /> {t("header.projects.title")}
            </CommandItem>
            <CommandItem onSelect={() => go("/characters")}>
              <Users className="mr-2 h-4 w-4" /> {t("header.characters.title")}
            </CommandItem>
            <CommandItem onSelect={() => go("/generate")}>
              <Wand2 className="mr-2 h-4 w-4" /> {t("header.generate.title")}
            </CommandItem>
            <CommandItem onSelect={() => go("/history")}>
              <HistoryIcon className="mr-2 h-4 w-4" /> {t("header.history.title")}
            </CommandItem>
          </CommandGroup>

          {projects.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("header.projects.title")}>
                {projects.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`project ${p.title}`}
                    onSelect={() => go(`/projects/${p.id}`)}
                  >
                    <Compass className="mr-2 h-4 w-4" /> {p.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {episodes.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("header.episodes.title")}>
                {episodes.map((ep) => (
                  <CommandItem
                    key={ep.id}
                    value={`episode ${ep.title ?? ep.id}`}
                    onSelect={() => go(`/episodes/${ep.id}`)}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" /> {ep.title || ep.id.slice(0, 8)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {characters.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("header.characters.title")}>
                {characters.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`character ${c.display_name}`}
                    onSelect={() => go("/characters")}
                  >
                    <Users className="mr-2 h-4 w-4" /> {c.display_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
