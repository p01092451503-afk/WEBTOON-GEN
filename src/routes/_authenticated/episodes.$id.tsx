import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getEpisode, createPanel, deletePanel } from "@/lib/projects.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/episodes/$id")({
  component: EpisodeStoryboard,
  head: () => ({ meta: [{ title: "Storyboard · toonpilot" }] }),
});

function EpisodeStoryboard() {
  const { id } = useParams({ from: "/_authenticated/episodes/$id" });
  const get = useServerFn(getEpisode);
  const addPanel = useServerFn(createPanel);
  const delPanel = useServerFn(deletePanel);
  const qc = useQueryClient();
  const [caption, setCaption] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["episode", id], queryFn: () => get({ data: { id } }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["episode", id] });

  const addMut = useMutation({
    mutationFn: () => addPanel({ data: { episode_id: id, caption: caption || undefined } }),
    onSuccess: () => { invalidate(); setCaption(""); toast.success("Panel added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (panelId: string) => delPanel({ data: { id: panelId } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Storyboard</div>
          <h1 className="text-2xl font-extrabold tracking-tight">{data.episode.title}</h1>
          <Link
            to="/projects/$id" params={{ id: (data.episode as any).project_id }}
            className="text-xs text-primary hover:underline"
          >
            ← Back to project
          </Link>
        </div>
        <Button asChild variant="ghost" className="rounded-xl">
          <Link to="/generate">Open Studio →</Link>
        </Button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-toss"
      >
        <Plus className="h-5 w-5 text-primary" />
        <Input
          value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder="Panel caption (optional)" className="h-11 rounded-xl border-border"
        />
        <Button type="submit" disabled={addMut.isPending} className="h-11 rounded-xl">Add panel</Button>
      </form>

      {data.panels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No panels yet. Add the first panel above.
        </div>
      ) : (
        <ol className="space-y-3">
          {data.panels.map((panel: any) => (
            <li key={panel.id} className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-toss">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Panel {panel.order_index + 1}</div>
                  <div className="text-sm">{panel.caption || <span className="text-muted-foreground">No caption</span>}</div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {panel.status}
                  </span>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => { if (confirm("Delete this panel?")) delMut.mutate(panel.id); }}
                    className="rounded-lg text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Panel editor (linked generation) ships in S2.
      </p>
    </div>
  );
}
