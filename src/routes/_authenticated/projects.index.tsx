import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listProjects, createProject, deleteProject } from "@/lib/projects.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderPlus, Trash2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: ProjectsIndex,
  head: () => ({ meta: [{ title: "Projects · toonpilot" }] }),
});

function ProjectsIndex() {
  const list = useServerFn(listProjects);
  const create = useServerFn(createProject);
  const del = useServerFn(deleteProject);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");

  const { data = [], isLoading } = useQuery({ queryKey: ["projects"], queryFn: () => list() });

  const createMut = useMutation({
    mutationFn: (t: string) => create({ data: { title: t } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); setTitle(""); toast.success("Project created"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <form
        onSubmit={(e) => { e.preventDefault(); if (title.trim()) createMut.mutate(title.trim()); }}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-toss"
      >
        <FolderPlus className="h-5 w-5 text-primary" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New project title"
          className="h-11 rounded-xl border-border"
        />
        <Button type="submit" disabled={createMut.isPending} className="h-11 rounded-xl">Create</Button>
      </form>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No projects yet. Create your first project above.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((p) => (
            <div key={p.id} className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-toss transition hover:border-primary/40">
              <div className="min-w-0">
                <div className="truncate text-base font-bold">{p.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="sm" className="rounded-lg">
                  <Link to="/projects/$id" params={{ id: p.id }}>
                    Open <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { if (confirm(`Delete "${p.title}"?`)) delMut.mutate(p.id); }}
                  className="rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
