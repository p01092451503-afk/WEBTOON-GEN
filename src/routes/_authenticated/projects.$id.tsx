import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getProject, createEpisode, deleteEpisode,
  addCastMember, removeCastMember,
} from "@/lib/projects.functions";
import { useCharacters } from "@/hooks/useCharacters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Trash2, Plus, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetail,
  head: () => ({ meta: [{ title: "Project · toonpilot" }] }),
});

function ProjectDetail() {
  const { id } = useParams({ from: "/_authenticated/projects/$id" });
  const get = useServerFn(getProject);
  const addEp = useServerFn(createEpisode);
  const delEp = useServerFn(deleteEpisode);
  const addCast = useServerFn(addCastMember);
  const rmCast = useServerFn(removeCastMember);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["project", id], queryFn: () => get({ data: { id } }) });
  const { data: characters = [] } = useCharacters();

  const [epTitle, setEpTitle] = useState("");
  const [pickChar, setPickChar] = useState<string>("");
  const [roleLabel, setRoleLabel] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project", id] });

  const addEpMut = useMutation({
    mutationFn: (t: string) => addEp({ data: { project_id: id, title: t } }),
    onSuccess: () => { invalidate(); setEpTitle(""); toast.success("Episode added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delEpMut = useMutation({
    mutationFn: (epId: string) => delEp({ data: { id: epId } }),
    onSuccess: () => { invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addCastMut = useMutation({
    mutationFn: () => addCast({ data: { project_id: id, character_id: pickChar, role_label: roleLabel || undefined } }),
    onSuccess: () => { invalidate(); setPickChar(""); setRoleLabel(""); toast.success("Cast added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rmCastMut = useMutation({
    mutationFn: (character_id: string) => rmCast({ data: { project_id: id, character_id } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const castIds = new Set(data.cast.map((c: any) => c.character_id));
  const available = characters.filter((c) => !castIds.has(c.id));

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Project</div>
            <h1 className="text-2xl font-extrabold tracking-tight">{data.project.title}</h1>
          </div>
          <Button asChild variant="ghost" className="rounded-xl">
            <Link to="/projects">← All projects</Link>
          </Button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (epTitle.trim()) addEpMut.mutate(epTitle.trim()); }}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-toss"
        >
          <Plus className="h-5 w-5 text-primary" />
          <Input
            value={epTitle} onChange={(e) => setEpTitle(e.target.value)}
            placeholder="New episode title" className="h-11 rounded-xl border-border"
          />
          <Button type="submit" disabled={addEpMut.isPending} className="h-11 rounded-xl">Add episode</Button>
        </form>

        {data.episodes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No episodes yet. Add one above.
          </div>
        ) : (
          <ol className="space-y-2">
            {data.episodes.map((ep: any) => (
              <li key={ep.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-toss">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                    {ep.order_index + 1}
                  </span>
                  <div className="truncate text-base font-semibold">{ep.title}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild size="sm" variant="ghost" className="rounded-lg">
                    <Link to="/episodes/$id" params={{ id: ep.id }}>
                      Open <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => { if (confirm(`Delete "${ep.title}"?`)) delEpMut.mutate(ep.id); }}
                    className="rounded-lg text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <aside className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-toss">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold">Cast</div>
            <div className="text-xs text-muted-foreground">{data.cast.length}</div>
          </div>

          <div className="space-y-2">
            {data.cast.length === 0 && (
              <div className="text-xs text-muted-foreground">No cast yet.</div>
            )}
            {data.cast.map((c: any) => (
              <div key={c.character_id} className="flex items-center justify-between rounded-xl border border-border p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.characters?.display_name ?? "—"}</div>
                  {c.role_label && <div className="truncate text-xs text-muted-foreground">{c.role_label}</div>}
                </div>
                <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground hover:text-destructive"
                  onClick={() => rmCastMut.mutate(c.character_id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <div className="text-xs font-semibold text-muted-foreground">Add character</div>
            <Select value={pickChar} onValueChange={setPickChar}>
              <SelectTrigger className="h-10 rounded-xl border-border">
                <SelectValue placeholder={available.length === 0 ? "No characters" : "Choose character"} />
              </SelectTrigger>
              <SelectContent>
                {available.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)}
              placeholder="Role (e.g. Protagonist)" className="h-10 rounded-xl border-border"
            />
            <Button
              className="h-10 w-full rounded-xl" disabled={!pickChar || addCastMut.isPending}
              onClick={() => addCastMut.mutate()}
            >
              <UserPlus className="mr-1 h-4 w-4" /> Add to cast
            </Button>
            {characters.length === 0 && (
              <Link to="/characters" className="block pt-1 text-xs text-primary hover:underline">
                Create a character first →
              </Link>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
