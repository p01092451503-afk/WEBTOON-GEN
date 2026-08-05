import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CircleHelp, Download, Film, ImagePlus, Loader2, RefreshCw, Trash2, Video, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useVideoGeneration } from "@/hooks/useVideoGeneration";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { SignedImage } from "@/components/SignedImage";
import { StudioSwitcher } from "@/components/studio-switcher";
import { VideoOnboardingTour, shouldStartVideoTour } from "@/components/video-onboarding-tour";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzeReferences, type ReferenceBrief } from "@/lib/reference-analysis.functions";
import { composeVideoPrompt } from "@/lib/video-prompt.functions";
import { checkVideoModelHealth } from "@/lib/video-health.functions";
import { explainVideoError } from "@/lib/video-errors";
import { extractVideoFrames } from "@/lib/videoFrames";

type MediaAsset = { id: string; name: string; kind: "image" | "video"; coverPath: string; framePaths: string[] };
type Health = { models: Array<{ provider: string; status: "available" | "unavailable" | "unknown" }> };

export function VideoPlaygroundPage() {
  const { tenantId } = useTenant();
  const gen = useVideoGeneration(tenantId);
  const analyze = useServerFn(analyzeReferences);
  const compose = useServerFn(composeVideoPrompt);
  const checkHealth = useServerFn(checkVideoModelHealth);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => { if (shouldStartVideoTour()) setTourOpen(true); }, []);
  useEffect(() => {
    let active = true;
    const run = async () => { try { const result = await checkHealth({ data: undefined }); if (active) setHealth(result as Health); } catch { if (active) setHealth(null); } };
    void run();
    const timer = window.setInterval(() => void run(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [checkHealth]);

  const studyPaths = useMemo(() => assets.flatMap((asset) => asset.framePaths).slice(0, 8), [assets]);
  const firstReference = studyPaths[0] ?? null;
  const hasVideo = assets.some((asset) => asset.kind === "video");
  const readyCount = health?.models.filter((model) => model.status === "available").length ?? 0;
  const busy = uploading || preparing || gen.running;

  async function uploadBlob(blob: Blob, name: string) {
    if (!tenantId) throw new Error("NO_TENANT");
    const path = `${tenantId}/video-refs/${Date.now()}-${crypto.randomUUID()}-${name}`;
    const { error } = await supabase.storage.from("character-refs").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
    if (error) throw error;
    return path;
  }

  async function addMedia(files: FileList) {
    setUploading(true);
    try {
      const added: MediaAsset[] = [];
      for (const file of Array.from(files)) {
        if (assets.length + added.length >= 6) break;
        if (file.type.startsWith("video/")) {
          const frames = await extractVideoFrames(file, 3);
          const paths: string[] = [];
          for (let i = 0; i < frames.length; i += 1) paths.push(await uploadBlob(frames[i], `frame-${i}.jpg`));
          if (paths.length) added.push({ id: crypto.randomUUID(), name: file.name, kind: "video", coverPath: paths[0], framePaths: paths });
        } else if (file.type.startsWith("image/")) {
          const extension = file.name.split(".").pop() || "jpg";
          const path = await uploadBlob(file, `reference.${extension}`);
          added.push({ id: crypto.randomUUID(), name: file.name, kind: "image", coverPath: path, framePaths: [path] });
        }
      }
      if (!added.length) throw new Error("Add an image or video file.");
      setAssets((current) => [...current, ...added].slice(0, 6));
      toast.success(`${added.length} reference${added.length === 1 ? "" : "s"} added.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
    finally { setUploading(false); }
  }

  async function generate() {
    if (!prompt.trim()) return toast.error("Describe the video you want to create.");
    setPreparing(true);
    try {
      let brief: ReferenceBrief | null = null;
      if (studyPaths.length) {
        brief = await analyze({ data: { imagePaths: studyPaths, intent: prompt.trim(), hasVideoFrames: hasVideo } }) as ReferenceBrief;
      }
      const composed = await compose({ data: {
        subject: brief?.subject ?? "", action: prompt.trim(),
        camera: [brief?.camera, brief?.motion].filter(Boolean).join("; "),
        lighting: brief?.lighting ?? "", style: brief?.style ?? "",
      } });
      await gen.run({
        workLabel: "Playground", provider: "auto", mode: firstReference ? "i2v" : "t2v",
        finalPrompt: composed.finalPrompt, negativePrompt: brief?.negative || undefined,
        rawPrompt: prompt.trim(), promptEdited: true, aspectRatio: "16:9", resolution: "720p",
        durationSeconds: 10, cameraFixed: false, seed: null, imagePaths: studyPaths,
        options: { playground: true, referenceStudyPaths: studyPaths, referenceHasVideo: hasVideo, referenceBrief: brief,
          references: assets.map((asset) => ({ name: asset.name, kind: asset.kind, directlySuppliedToModel: true })) },
      });
      toast.success("Your video is now being created.");
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
    finally { setPreparing(false); }
  }

  return <main className="px-4 py-5 sm:px-6">
    <StudioSwitcher active="video" />
    <div className="mx-auto mt-5 max-w-6xl">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-2 text-3xl font-extrabold">What do you want to create?</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Add reference images or videos, then describe your scene. Their subjects, visual style, lighting, and motion are studied and supplied directly to the video model.</p></div>
        <div className="flex items-center gap-2"><span className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">{health ? `${readyCount} engine${readyCount === 1 ? "" : "s"} ready` : "Checking engines"}</span>
          <Button variant="outline" size="icon" onClick={() => setTourOpen(true)} aria-label="Open quick tour"><CircleHelp className="h-4 w-4" /></Button></div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section data-video-tour="playground" className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-6 py-4"><h2 className="font-bold">Create a video</h2><p className="mt-1 text-xs text-muted-foreground">Uploaded references are analyzed and used during generation. Your prompt is required.</p></div>
          <div className="space-y-6 p-6">
            <div data-video-tour="references" className="space-y-3"><div className="flex items-center justify-between"><Label className="font-bold">Reference images & videos</Label>{assets.length > 0 && <Button variant="ghost" size="sm" onClick={() => setAssets([])}><Trash2 className="h-4 w-4" /> Clear</Button>}</div>
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-5 text-center hover:border-primary/50 hover:bg-primary-soft">{uploading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <ImagePlus className="h-7 w-7 text-primary" />}<span className="text-sm font-bold">{uploading ? "Preparing references…" : "Add images or videos"}</span><span className="text-xs text-muted-foreground">Up to 6 files · images teach appearance and style · videos teach motion</span>
                <input type="file" accept="image/*,video/*" multiple className="hidden" disabled={busy} onChange={(event) => { if (event.target.files?.length) void addMedia(event.target.files); event.target.value = ""; }} /></label>
              {assets.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{assets.map((asset) => <div key={asset.id} className="overflow-hidden rounded-lg border border-border bg-muted/30"><SignedImage bucket="character-refs" path={asset.coverPath} alt={asset.name} className="aspect-video w-full object-cover" /><div className="flex items-center gap-2 px-3 py-2">{asset.kind === "video" ? <Video className="h-3.5 w-3.5 text-primary" /> : <ImagePlus className="h-3.5 w-3.5 text-primary" />}<span className="min-w-0 flex-1 truncate text-xs font-semibold">{asset.name}</span><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))} aria-label={`Remove ${asset.name}`}><X className="h-3.5 w-3.5" /></Button></div></div>)}</div>}
            </div>
            <div data-video-tour="prompt" className="space-y-3"><div className="flex justify-between"><Label htmlFor="video-prompt" className="font-bold">Describe your video</Label><span className="text-xs text-muted-foreground">{prompt.length}/3000</span></div><Textarea id="video-prompt" value={prompt} maxLength={3000} disabled={busy} onChange={(event) => setPrompt(event.target.value)} placeholder="A woman in a red coat walks through a rainy neon street, then turns toward the camera and smiles…" className="min-h-44 resize-y rounded-lg text-base leading-relaxed" /><p className="text-xs text-muted-foreground">Write naturally in Korean or English. Your intent is preserved while the prompt is optimized automatically.</p></div>
            <Button data-video-tour="generate" onClick={generate} disabled={busy || !prompt.trim()} className="h-13 w-full text-base font-bold">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Film className="h-5 w-5" />}{preparing ? "Preparing the best prompt…" : gen.running ? "Generating video…" : "Generate video"}</Button>
          </div>
        </section>
        <aside data-video-tour="result" className="rounded-lg border border-border bg-card p-6"><h2 className="font-bold">Result</h2><p className="mt-1 text-xs text-muted-foreground">Your generated video appears here.</p><div className="mt-5 space-y-4">
          {gen.running && <EmptyResult loading />}{gen.recoveryNotice && <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary-soft p-4 text-xs"><RefreshCw className="h-4 w-4 animate-spin text-primary" /><p>{gen.recoveryNotice}</p></div>}{gen.error && <ErrorCard message={gen.error} />}{gen.row?.results?.map((result) => <ResultVideo key={result.id} path={result.storage_path} />)}{!gen.running && !gen.row && !gen.error && <EmptyResult />}
          {gen.row?.final_prompt && <details className="rounded-lg border border-border p-4 text-xs"><summary className="cursor-pointer font-bold">View enhanced prompt</summary><p className="mt-3 whitespace-pre-wrap leading-relaxed text-muted-foreground">{gen.row.final_prompt}</p></details>}
        </div></aside>
      </div>
    </div><VideoOnboardingTour open={tourOpen} onOpenChange={setTourOpen} />
  </main>;
}

function EmptyResult({ loading = false }: { loading?: boolean }) { return <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-6 text-center">{loading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Film className="h-8 w-8 text-muted-foreground" />}<p className="text-sm text-muted-foreground">{loading ? "Creating your video. You can safely leave this page." : "Add references if you have them, describe the scene, and generate."}</p></div>; }
function ErrorCard({ message }: { message: string }) { const info = explainVideoError(message); return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs"><p className="font-bold text-destructive">{info.title}</p><p className="mt-1 text-foreground/80">{info.hint}</p>{info.checks.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4">{info.checks.map((item) => <li key={item}>{item}</li>)}</ul>}</div>; }
function ResultVideo({ path }: { path: string }) { const url = useSignedUrl("generation-outputs", path, 300); const [downloading, setDownloading] = useState(false); async function download() { setDownloading(true); try { const name = path.split("/").pop() || "pilotstudio-video.mp4"; const { data, error } = await supabase.storage.from("generation-outputs").createSignedUrl(path, 60, { download: name }); if (error || !data?.signedUrl) throw error || new Error("Download failed"); const link = document.createElement("a"); link.href = data.signedUrl; link.download = name; document.body.appendChild(link); link.click(); link.remove(); } catch (error) { toast.error(error instanceof Error ? error.message : "Download failed"); } finally { setDownloading(false); } } if (!url) return <div className="aspect-video animate-pulse rounded-lg bg-muted" />; return <div className="space-y-3"><video src={url} controls playsInline className="aspect-video w-full rounded-lg border border-border bg-foreground object-contain" /><Button variant="outline" className="w-full" onClick={download} disabled={downloading}>{downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download</Button></div>; }