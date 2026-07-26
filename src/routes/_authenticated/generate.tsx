import { useEffect, useMemo, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCharacters } from "@/hooks/useCharacters";
import { usePresets } from "@/hooks/usePresets";
import { useGeneration } from "@/hooks/useGeneration";
import { SignedImage } from "@/components/SignedImage";
import { buildFigureMap, buildPrompt, WARN, type WorkInput, type PresetItem } from "@/lib/promptEngine";
import { updatePanel } from "@/lib/projects.functions";
import { ArrowLeft, Lock, Unlock, GitCompare, Check, Sparkles, ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/generate")({
  component: GeneratePage,
  head: () => ({ meta: [{ title: "Studio · toonpilot" }] }),
});

type RefState = { path: string; url?: string } | null;

const DEFAULT_WORK: WorkInput = {
  poseStrengthId: "POS_002",
  bgStrengthId: "BGS_002",
  bodySourceId: "BOD_000",
  cameraAngleId: "CAM_A_000",
  cameraDistanceId: "CAM_D_000",
  cameraPositionId: "CAM_P_000",
  focusTargetId: "FOC_000",
  bgStyleId: "BGST_000",
  costumeModeId: "CST_000",
  emotionId: "EMO_000",
  styleFinishId: "STY_001",
  actionText: "",
  directionMemo: "",
  isPhotopose: false,
};

function GeneratePage() {
  const { tenantId } = useTenant();
  const { data: characters = [] } = useCharacters();
  const { data: cfg = {} } = usePresets(tenantId);
  const gen = useGeneration(tenantId);

  const [charAId, setCharAId] = useState<string | null>(null);
  const [charBId, setCharBId] = useState<string | null>(null);
  const [bgRef, setBgRef] = useState<RefState>(null);
  const [poseRef, setPoseRef] = useState<RefState>(null);
  const [styleRef, setStyleRef] = useState<RefState>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [batchCount, setBatchCount] = useState<number>(1);
  const [work, setWork] = useState<WorkInput>(DEFAULT_WORK);
  const [restoredNote, setRestoredNote] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [backEpisodeId, setBackEpisodeId] = useState<string | null>(null);
  const [lockedSeeds, setLockedSeeds] = useState<Record<number, number>>({});
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const updatePanelFn = useServerFn(updatePanel);

  // Read query params: panel / charA / charB / back
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const panel = q.get("panel");
    const chA = q.get("charA");
    const chB = q.get("charB");
    const back = q.get("back");
    if (panel) setPanelId(panel);
    if (back) setBackEpisodeId(back);
    if (chA) setCharAId(chA);
    if (chB) setCharBId(chB);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem("toonpilot:restore");
    if (!raw) return;
    sessionStorage.removeItem("toonpilot:restore");
    try {
      const r = JSON.parse(raw);
      if (r.options && typeof r.options === "object") {
        setWork((prev) => {
          const merged: WorkInput = { ...prev };
          for (const k of Object.keys(prev) as (keyof WorkInput)[]) {
            if (r.options[k] !== undefined) (merged as any)[k] = r.options[k];
          }
          return merged;
        });
        if (typeof r.options.aspectRatio === "string") setAspectRatio(r.options.aspectRatio);
      }
      if (typeof r.aspectRatio === "string") setAspectRatio(r.aspectRatio);
      if (typeof r.batchCount === "number") setBatchCount(Math.max(1, Math.min(4, r.batchCount)));
      setRestoredNote(`Restored settings from previous generation (${r.workLabel ?? "W1"}).`);
      toast.success("Previous settings restored.");
    } catch {
      // ignore
    }
  }, []);

  const charA = characters.find((c) => c.id === charAId) || null;
  const charB = characters.find((c) => c.id === charBId) || null;

  const figureMap = useMemo(
    () =>
      buildFigureMap({
        hasCharA: !!charA,
        hasCharB: !!charB,
        hasBg: !!bgRef,
        hasPose: !!poseRef,
        hasStyle: !!styleRef,
        charAName: charA?.display_name,
        charBName: charB?.display_name,
      }),
    [charA, charB, bgRef, poseRef, styleRef],
  );

  const built = useMemo(() => buildPrompt(work, figureMap, cfg), [work, figureMap, cfg]);

  const uploadRef = useCallback(
    async (file: File, kind: "bg" | "pose" | "style") => {
      if (!tenantId) return;
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${tenantId}/refs/${kind}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("character-refs")
        .upload(path, file, { contentType: file.type });
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }
      const setter = kind === "bg" ? setBgRef : kind === "pose" ? setPoseRef : setStyleRef;
      setter({ path });
    },
    [tenantId],
  );

  async function handleGenerate() {
    if (!charA?.primary_path && !charB?.primary_path) {
      toast.error("Please select at least Character A or B.");
      return;
    }
    const imagePaths: string[] = [];
    if (charA?.primary_path) imagePaths.push(charA.primary_path);
    if (charB?.primary_path) imagePaths.push(charB.primary_path);
    if (bgRef) imagePaths.push(bgRef.path);
    if (poseRef) imagePaths.push(poseRef.path);
    if (styleRef) imagePaths.push(styleRef.path);
    try {
      await gen.run({
        workLabel: "W1",
        mode: "new",
        aspectRatio,
        finalPrompt: built.prompt,
        compiledPrompt: built.prompt,
        imagePaths,
        figureMap,
        options: { ...work, aspectRatio },
        batchCount,
        panelId: panelId ?? undefined,
      });
      toast.success(panelId ? "Panel generation submitted" : "Generation request submitted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  const hasPresets = Object.keys(cfg).length > 0;

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-6 sm:py-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-primary">Studio</div>
          <h1 className="mt-1 truncate text-3xl font-extrabold tracking-tight">Generate image</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick references and options — the prompt assembles itself.
          </p>
        </div>
        <Link
          to="/characters"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-primary-soft px-4 text-sm font-semibold text-primary hover:bg-primary-soft/70"
        >
          Manage characters
        </Link>
      </header>

      {panelId && backEpisodeId && (
        <div className="mt-4">
          <Link
            to="/episodes/$id" params={{ id: backEpisodeId }}
            className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-xs font-bold text-primary hover:bg-primary-soft/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Editing storyboard panel — back to episode
          </Link>
        </div>
      )}

      {(!hasPresets || restoredNote) && (
        <div className="mt-4 space-y-2">
          {!hasPresets && (
            <NoticeBar tone="warn">
              No preset data found. Seed data is required in the presets table.
            </NoticeBar>
          )}
          {restoredNote && (
            <NoticeBar tone="info" onClose={() => setRestoredNote(null)}>
              {restoredNote} Please re-select reference images and characters.
            </NoticeBar>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Panel 1: References */}
        <Panel step={1} title="References" className="lg:col-span-3">
          <div className="space-y-4">
            <FieldGroup label="Character A">
              <CharacterPicker value={charAId} onChange={setCharAId} characters={characters} />
            </FieldGroup>
            <FieldGroup label="Character B">
              <CharacterPicker value={charBId} onChange={setCharBId} characters={characters} />
            </FieldGroup>
            <RefUpload
              label="Background"
              value={bgRef}
              onFile={(f) => uploadRef(f, "bg")}
              onClear={() => setBgRef(null)}
            />
            <RefUpload
              label="Pose / Composition"
              value={poseRef}
              onFile={(f) => uploadRef(f, "pose")}
              onClear={() => setPoseRef(null)}
            />
            <RefUpload
              label="Style (Advanced)"
              value={styleRef}
              onFile={(f) => uploadRef(f, "style")}
              onClear={() => setStyleRef(null)}
            />
          </div>
        </Panel>

        {/* Panel 2: Prompt Controls */}
        <Panel step={2} title="Prompt Controls" className="lg:col-span-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <PresetSelect label="Pose Strength" sheet="PoseStrength" cfg={cfg} value={work.poseStrengthId} onChange={(v) => setWork({ ...work, poseStrengthId: v })} />
              <PresetSelect label="Bg Strength" sheet="BgStrength" cfg={cfg} value={work.bgStrengthId} onChange={(v) => setWork({ ...work, bgStrengthId: v })} />
              <PresetSelect label="Body Source" sheet="BodySource" cfg={cfg} value={work.bodySourceId} onChange={(v) => setWork({ ...work, bodySourceId: v })} />
              <PresetSelect label="Camera Angle" sheet="CameraAngle" cfg={cfg} value={work.cameraAngleId} onChange={(v) => setWork({ ...work, cameraAngleId: v })} />
              <PresetSelect label="Camera Distance" sheet="CameraDistance" cfg={cfg} value={work.cameraDistanceId} onChange={(v) => setWork({ ...work, cameraDistanceId: v })} />
              <PresetSelect label="Camera Position" sheet="CameraPosition" cfg={cfg} value={work.cameraPositionId} onChange={(v) => setWork({ ...work, cameraPositionId: v })} />
              <PresetSelect label="Focus" sheet="FocusTarget" cfg={cfg} value={work.focusTargetId} onChange={(v) => setWork({ ...work, focusTargetId: v })} />
              <PresetSelect label="Bg Style" sheet="BgStyle" cfg={cfg} value={work.bgStyleId} onChange={(v) => setWork({ ...work, bgStyleId: v })} />
              <PresetSelect label="Costume" sheet="CostumeMode" cfg={cfg} value={work.costumeModeId} onChange={(v) => setWork({ ...work, costumeModeId: v })} />
              <PresetSelect label="Emotion" sheet="Emotion" cfg={cfg} value={work.emotionId} onChange={(v) => setWork({ ...work, emotionId: v })} />
              <PresetSelect label="Style Finish" sheet="StyleFinish" cfg={cfg} value={work.styleFinishId} onChange={(v) => setWork({ ...work, styleFinishId: v })} />
            </div>

            <FieldGroup label="Action">
              <Textarea
                rows={2}
                value={work.actionText}
                onChange={(e) => setWork({ ...work, actionText: e.target.value })}
                placeholder="e.g. they hold hands and walk toward the camera"
                className="resize-none rounded-xl bg-muted/50"
              />
            </FieldGroup>
            <FieldGroup label="Direction Memo">
              <Textarea
                rows={2}
                value={work.directionMemo}
                onChange={(e) => setWork({ ...work, directionMemo: e.target.value })}
                className="resize-none rounded-xl bg-muted/50"
              />
            </FieldGroup>

            <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Photopose</div>
                <div className="text-xs text-muted-foreground">Use photorealistic pose</div>
              </div>
              <Switch
                checked={work.isPhotopose}
                onCheckedChange={(v) => setWork({ ...work, isPhotopose: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FieldGroup label="Aspect Ratio">
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger className="h-10 rounded-xl bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"].map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldGroup>
              <FieldGroup label="Batch">
                <Input
                  type="number"
                  min={1}
                  max={4}
                  value={batchCount}
                  onChange={(e) =>
                    setBatchCount(Math.max(1, Math.min(4, Number(e.target.value) || 1)))
                  }
                  className="h-10 rounded-xl bg-muted/50 px-3"
                />
              </FieldGroup>
            </div>
          </div>
        </Panel>

        {/* Panel 3: Figure Map */}
        <Panel step={3} title="Figure Map" className="lg:col-span-2">
          {figureMap.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Add references and they'll map automatically.
            </div>
          ) : (
            <div className="space-y-2">
              {figureMap.map((f) => (
                <div
                  key={f.figNo}
                  className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary text-[10px] font-black text-primary-foreground">
                    {f.figNo}
                  </span>
                  <span className="truncate text-xs font-medium">{f.label}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Panel 4: Final Prompt & Result */}
        <Panel step={4} title="Final Prompt" className="lg:col-span-3">
          <div className="space-y-3">
            <Textarea
              rows={10}
              readOnly
              value={built.prompt}
              className="resize-none rounded-xl bg-muted/50 font-mono text-xs leading-relaxed"
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{built.wordCount} words</span>
              {built.warnings.length > 0 && (
                <div className="text-right text-amber-600">
                  {built.warnings.map((w) => (
                    <div key={w}>{(WARN as Record<string, string>)[w] || w}</div>
                  ))}
                </div>
              )}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={gen.running}
              className="h-12 w-full rounded-xl bg-primary text-[15px] font-bold text-primary-foreground shadow-toss hover:bg-primary/90"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {gen.running ? "Requesting…" : "Generate"}
            </Button>

            {gen.row && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <StatusPill status={gen.row.status} />
                  <span className="truncate text-[11px] text-muted-foreground">
                    {gen.currentId}
                  </span>
                </div>
                {gen.row.error_message && (
                  <p className="rounded-xl bg-destructive/10 p-2 text-xs text-destructive break-all">
                    {gen.row.error_message}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {gen.row.results.map((r) => (
                    <SignedImage
                      key={r.id}
                      bucket="generation-outputs"
                      path={r.storage_path}
                      alt={`result-${r.seq}`}
                      className="aspect-square w-full rounded-xl border border-border object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </main>
  );
}

/* ---------- helpers ---------- */

function Panel({
  step,
  title,
  className,
  children,
}: {
  step: number;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        "rounded-3xl border border-border bg-card p-5 shadow-toss-sm " + (className ?? "")
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-primary-soft text-[11px] font-black text-primary">
          {step}
        </span>
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NoticeBar({
  tone,
  children,
  onClose,
}: {
  tone: "info" | "warn";
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-300/50 bg-amber-50 text-amber-800"
      : "border-primary/20 bg-primary-soft text-primary";
  return (
    <div className={`flex items-start justify-between gap-2 rounded-2xl border px-4 py-3 text-sm ${cls}`}>
      <span>{children}</span>
      {onClose && (
        <button onClick={onClose} className="shrink-0 rounded-full p-1 hover:bg-black/5">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    done: "bg-emerald-100 text-emerald-700",
    error: "bg-destructive/10 text-destructive",
    queued: "bg-muted text-muted-foreground",
    running: "bg-primary-soft text-primary",
  };
  const cls = styles[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{status}</span>
  );
}

function CharacterPicker({
  value,
  onChange,
  characters,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  characters: { id: string; display_name: string; primary_path: string | null }[];
}) {
  return (
    <div className="space-y-2">
      <Select
        value={value ?? "__none"}
        onValueChange={(v) => onChange(v === "__none" ? null : v)}
      >
        <SelectTrigger className="h-10 rounded-xl bg-muted/50">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">(none)</SelectItem>
          {characters.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {characters.length === 0 && (
        <p className="text-[11px] leading-tight text-muted-foreground">
          No characters yet. Add one on the{" "}
          <Link to="/characters" className="font-semibold text-primary underline">
            characters
          </Link>{" "}
          page.
        </p>
      )}
      {value && (
        <SignedImage
          bucket="character-refs"
          path={characters.find((c) => c.id === value)?.primary_path}
          alt="char"
          className="aspect-square w-full rounded-xl border border-border object-cover"
        />
      )}
    </div>
  );
}

function RefUpload({
  label,
  value,
  onFile,
  onClear,
}: {
  label: string;
  value: RefState;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
      {value ? (
        <div className="space-y-2">
          <SignedImage
            bucket="character-refs"
            path={value.path}
            alt={label}
            className="aspect-square w-full rounded-xl border border-border object-cover"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive"
            onClick={onClear}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Remove
          </Button>
        </div>
      ) : (
        <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-xs text-muted-foreground hover:bg-muted">
          <ImagePlus className="mb-1 h-4 w-4" />
          Choose image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

function PresetSelect({
  label,
  sheet,
  cfg,
  value,
  onChange,
}: {
  label: string;
  sheet: string;
  cfg: Record<string, { id: string; label_ko: string; label_en?: string }[]>;
  value: string;
  onChange: (v: string) => void;
}) {
  const items = cfg[sheet] ?? [];
  const displayLabel = (it: { label_en?: string; label_ko: string }) =>
    (it.label_en && it.label_en.trim()) || it.label_ko;
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-xl bg-muted/50">
          <SelectValue placeholder={items.length === 0 ? "(empty)" : "Select"} />
        </SelectTrigger>
        <SelectContent>
          {items.length === 0 ? (
            <SelectItem value={value} disabled>
              (no presets)
            </SelectItem>
          ) : (
            items.map((it) => (
              <SelectItem key={it.id} value={it.id}>
                {displayLabel(it)}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
