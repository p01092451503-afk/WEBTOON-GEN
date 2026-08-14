import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCharacters } from "@/hooks/useCharacters";
import { usePresets } from "@/hooks/usePresets";
import { useGeneration } from "@/hooks/useGeneration";
import { SignedImage } from "@/components/SignedImage";
import { ImageDownloadMenu } from "@/components/image-download-menu";
import { ImageLightbox } from "@/components/image-lightbox";
import { generateErrorKey } from "@/lib/generate-error";
import { buildPrompt, WARN, type WorkInput, type PresetItem } from "@/lib/promptEngine";
import { buildStudioFigures, MAX_REFS, type StudioRef } from "@/lib/studioRefs";
import { consumePendingRefs, type PendingRef } from "@/lib/pendingRefs";
import { consumeEditRestore } from "@/lib/historyActions";
import { StudioControlPanel } from "@/components/studio/control-panel";
import { StudioOutputPanel, type OutputItem } from "@/components/studio/output-panel";
import { updatePanel } from "@/lib/projects.functions";
import { translatePrompt } from "@/lib/translate.functions";
import { Languages, Loader2 } from "lucide-react";
import {
  ArrowLeft, Lock, Unlock, GitCompare, Check, Sparkles, ImagePlus, X,
  Smile, Meh, Frown, Angry, Laugh, Annoyed, Heart, AlertCircle,
  Moon, Zap, Snowflake, Brain, Ghost, Drama,
  Triangle, Camera, Video, Focus, Move, PersonStanding,
  Aperture, Scan, Ruler, Compass, Eye, ArrowUp, ArrowDown,
  ArrowUpRight, ArrowDownRight, ArrowLeftRight, RotateCcw, RotateCw,
  ArrowUpFromLine, ArrowDownFromLine,
  User, UserCircle2, Users, Crop, Maximize2, Minimize2, Expand,
  ChevronsUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Home, TreePine, Waves, Building2, Coffee, GraduationCap, Bed,
  Castle, Cpu, Cloud, CloudSnow, CloudRain, Sun, Flower2,
  Layers, Palette, Brush, PenTool, Pencil, Grid3x3, Film, Image as ImageIcon,
  Gauge, Sliders, Target, Circle, Square,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StudioSwitcher } from "@/components/studio-switcher";
import { ImageModelHealthCard } from "@/components/image-model-health-card";


import { IconTooltip } from "@/components/icon-tooltip";
import { IconBadge } from "@/components/icon-badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AutoResizeTextarea } from "@/components/auto-resize-textarea";
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
  head: () => ({ meta: [{ title: "Studio · pilottoon" }] }),
});



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
  const { t } = useTranslation();
  const { tenantId } = useTenant();
  const { data: characters = [] } = useCharacters();
  const { data: cfg = {} } = usePresets(tenantId);
  const gen = useGeneration(tenantId);

  const [refs, setRefs] = useState<StudioRef[]>([]);
  const [charARefId, setCharARefId] = useState<string | null>(null);
  const [charBRefId, setCharBRefId] = useState<string | null>(null);
  const [cameraPresetKey, setCameraPresetKey] = useState<string | null>(null);
  const [pendingCharIds, setPendingCharIds] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [batchCount, setBatchCount] = useState<number>(1);
  const [work, setWork] = useState<WorkInput>(DEFAULT_WORK);

  const [restoredNote, setRestoredNote] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [backEpisodeId, setBackEpisodeId] = useState<string | null>(null);
  const [lockedSeeds, setLockedSeeds] = useState<Record<number, number>>({});
  const [lineItems, setLineItems] = useState<OutputItem[]>([]);
  const [editImagePath, setEditImagePath] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const updatePanelFn = useServerFn(updatePanel);
  const translateFn = useServerFn(translatePrompt);
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  // 편집 가능한 최종 프롬프트: null 이면 자동 생성값(built.prompt)을 그대로 사용
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
  const [promptEditMode, setPromptEditMode] = useState(false);
  // 원문 그대로 전송(Raw passthrough): 프리셋 조합을 쓰지 않고 사용자가 쓴 프롬프트를 그대로 Seedream API 로 보낸다.
  const [rawMode, setRawMode] = useState(false);
  const [rawPrompt, setRawPrompt] = useState("");

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
    setPendingCharIds([chA, chB].filter(Boolean) as string[]);
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
      setRestoredNote(t("studio.restored_prefix", { label: r.workLabel ?? "W1" }));
      toast.success(t("studio.restored_toast"));
    } catch {
      // ignore
    }
  }, []);

  // 쿼리 파라미터(charA/charB)로 들어온 캐릭터를 레퍼런스로 승격
  useEffect(() => {
    if (pendingCharIds.length === 0 || characters.length === 0) return;
    const picked = pendingCharIds
      .map((id) => characters.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c && !!c.primary_path);
    if (picked.length === 0) {
      setPendingCharIds([]);
      return;
    }
    const added: StudioRef[] = picked.map((c) => ({
      id: crypto.randomUUID(),
      path: c.primary_path as string,
      sourceName: c.display_name,
      roles: ["character"],
    }));
    setRefs((prev) => [...prev, ...added].slice(0, MAX_REFS));
    if (added[0]) setCharARefId(added[0].id);
    if (added[1]) setCharBRefId(added[1].id);
    setPendingCharIds([]);
  }, [pendingCharIds, characters]);

  // 이미지 그룹(/groups)에서 "레퍼런스로 사용"으로 넘어온 이미지 주입
  useEffect(() => {
    const pending = consumePendingRefs();
    if (pending.length === 0) return;
    const added: StudioRef[] = pending.map((p: PendingRef) => ({
      id: crypto.randomUUID(),
      path: p.path,
      sourceName: p.name,
      roles: (p.roles?.length ? p.roles : ["character"]) as StudioRef["roles"],
    }));
    setRefs((prev) => [...prev, ...added].slice(0, MAX_REFS));
    toast.success(
      t("studio.refs.injected", {
        defaultValue: "{{n}}개를 레퍼런스로 불러왔습니다.",
        n: added.length,
      }),
    );
  }, []);

  // 세션 "라인": 생성 결과가 realtime 으로 채워질 때마다 누적한다.
  useEffect(() => {
    const row = gen.row;
    if (!row || row.results.length === 0) return;
    setLineItems((prev) => {
      const known = new Set(prev.map((x) => x.id));
      const added = row.results
        .filter((r) => !known.has(r.id))
        .map<OutputItem>((r) => ({
          id: r.id,
          generationId: row.id,
          seq: r.seq,
          path: r.storage_path ?? r.thumb_path,
          seed: r.seed,
          createdAt: new Date().toISOString(),
          prompt: row.final_prompt,
          aspectRatio,
          status: row.status,
          errorMessage: row.error_message,
        }));
      return added.length ? [...added, ...prev] : prev;
    });
  }, [gen.row]);

  /** 생성 결과(generation-outputs)를 레퍼런스 버킷(character-refs)으로 복사한다. */
  async function copyOutputToRefs(path: string): Promise<string | null> {
    if (!tenantId) return null;
    const { data, error } = await supabase.storage.from("generation-outputs").download(path);
    if (error || !data) {
      toast.error(error?.message ?? "download failed");
      return null;
    }
    const ext = path.split(".").pop()?.toLowerCase() || "png";
    const dest = `${tenantId}/refs/out-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("character-refs")
      .upload(dest, data, { contentType: data.type || "image/png" });
    if (upErr) {
      toast.error(upErr.message);
      return null;
    }
    return dest;
  }

  async function useAsReference(item: OutputItem) {
    if (!item.path) return;
    if (refs.length >= MAX_REFS) {
      toast.error(t("studio.refs.max_reached", "레퍼런스는 최대 10개까지 추가할 수 있습니다."));
      return;
    }
    const dest = await copyOutputToRefs(item.path);
    if (!dest) return;
    setRefs((prev) =>
      prev.length >= MAX_REFS
        ? prev
        : [
            ...prev,
            {
              id: crypto.randomUUID(),
              path: dest,
              sourceName: `#${item.seq + 1}`,
              roles: ["character"],
            } as StudioRef,
          ],
    );
    toast.success(t("studio.output.added_ref", "레퍼런스에 추가했습니다."));
  }

  async function editImage(item: OutputItem) {
    if (!item.path) return;
    const dest = await copyOutputToRefs(item.path);
    if (!dest) return;
    setEditImagePath(dest);
    if (item.options && typeof item.options === "object") {
      setWork((prev) => {
        const merged: WorkInput = { ...prev };
        for (const k of Object.keys(prev) as (keyof WorkInput)[]) {
          if (item.options[k] !== undefined) (merged as any)[k] = item.options[k];
        }
        return merged;
      });
      if (typeof item.options.aspectRatio === "string") setAspectRatio(item.options.aspectRatio);
    }
    if (item.prompt) {
      setEditedPrompt(item.prompt);
      setPromptEditMode(true);
    }
    toast.success(t("studio.output.edit_loaded", "수정 모드로 불러왔습니다."));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const studioFigures = useMemo(
    () =>
      buildStudioFigures({
        refs,
        charARefId,
        charBRefId,
      }),
    [refs, charARefId, charBRefId],
  );
  const figureMap = studioFigures.figureMap;


  const built = useMemo(() => buildPrompt(work, figureMap, cfg), [work, figureMap, cfg]);

  // 사용자가 편집 중이면 편집본을, 아니면 자동 생성된 프롬프트를 최종값으로 사용
  const effectivePrompt = rawMode ? rawPrompt : (editedPrompt ?? built.prompt);
  const isEdited = !rawMode && editedPrompt !== null && editedPrompt.trim() !== built.prompt.trim();
  const overLimit = effectivePrompt.length > 4000;

  // Reset translation whenever the source prompt changes
  useEffect(() => {
    setTranslated(null);
    setShowTranslated(false);
  }, [effectivePrompt]);

  function resetEditedPrompt() {
    setEditedPrompt(null);
    setPromptEditMode(false);
  }

  async function handleTranslate() {
    if (!effectivePrompt) return;
    if (translated) {
      setShowTranslated((v) => !v);
      return;
    }
    setTranslating(true);
    try {
      const hasKorean = /[\u3131-\uD79D]/.test(effectivePrompt);
      const target: "ko" | "en" = hasKorean ? "en" : "ko";
      const res = await translateFn({ data: { text: effectivePrompt, target } });
      setTranslated(res.translated);
      setShowTranslated(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setTranslating(false);
    }
  }

  async function handleGenerate(opts?: { keepLocks?: boolean }) {
    if (!effectivePrompt.trim()) {
      toast.error(t("studio.labels.raw_empty", "Enter a prompt to send."));
      return;
    }
    if (overLimit) {
      toast.error(t("studio.labels.prompt_too_long", { max: 4000 }));
      return;
    }
    const imagePaths: string[] = studioFigures.imagePaths;


    const useLocks = opts?.keepLocks && Object.keys(lockedSeeds).length > 0;
    const seeds: number[] | undefined = useLocks
      ? Array.from({ length: batchCount }, (_, i) =>
          lockedSeeds[i] ?? Math.floor(Math.random() * 2_000_000_000),
        )
      : undefined;

    try {
      await gen.run({
        workLabel: "W1",
        mode: editImagePath ? "edit" : "new",
        editImagePath: editImagePath ?? undefined,
        aspectRatio,
        finalPrompt: effectivePrompt,
        rawPrompt: rawMode ? effectivePrompt : built.prompt,
        promptEdited: isEdited,
        rawPassthrough: rawMode,
        compiledPrompt: rawMode ? undefined : built.prompt,
        imagePaths,
        figureMap,
        options: { ...work, aspectRatio },
        batchCount,
        seeds,
        panelId: panelId ?? undefined,
      });
      setCompareIds([]);
      toast.success(panelId ? t("studio.submitted_panel") : t("studio.submitted"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const key = generateErrorKey(msg);
      toast.error(key ? t(key) : msg);
    }
  }

  function toggleLock(seq: number, seed: number | null) {
    if (seed == null) return;
    setLockedSeeds((prev) => {
      const next = { ...prev };
      if (next[seq] === seed) delete next[seq];
      else next[seq] = seed;
      return next;
    });
  }
  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }
  async function setAsPanel(resultId: string) {
    if (!panelId) return;
    try {
      await updatePanelFn({ data: { id: panelId, chosen_result_id: resultId, status: "done" } });
      toast.success(t("studio.panel_use_toast"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  const hasPresets = Object.keys(cfg).length > 0;

  return (
    <main className="max-w-[1400px] px-5 py-6 sm:py-8">
      <StudioSwitcher active="image" />
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">

        <div className="min-w-0">
          <div className="text-xs font-semibold text-primary">{t("studio.eyebrow")}</div>
          <h1 className="mt-1 truncate text-3xl font-extrabold tracking-tight">{t("studio.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("studio.sub")}
          </p>
        </div>
        <Link
          to="/groups"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-primary-soft px-4 text-sm font-semibold text-primary hover:bg-primary-soft/70"
        >
          {t("studio.manage_characters")}
        </Link>
      </header>

      <ImageModelHealthCard />


      {panelId && backEpisodeId && (
        <div className="mt-4">
          <Link
            to="/episodes/$id" params={{ id: backEpisodeId }}
            className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-xs font-bold text-primary hover:bg-primary-soft/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("studio.back_to_episode")}
          </Link>
        </div>
      )}

      {(!hasPresets || restoredNote) && (
        <div className="mt-4 space-y-2">
          {!hasPresets && (
            <NoticeBar tone="warn">
              {t("studio.no_presets")}
            </NoticeBar>
          )}
          {restoredNote && (
            <NoticeBar tone="info" onClose={() => setRestoredNote(null)}>
              {restoredNote} {t("studio.restored_note")}
            </NoticeBar>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(380px,440px)_1fr]">
        {/* 좌측: 컨트롤 패널 */}
        <aside className="rounded-3xl bg-card p-5 shadow-toss lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto [scrollbar-width:thin]">
          <StudioControlPanel
            tenantId={tenantId}
            cfg={cfg}
            refs={refs}
            setRefs={(next) => setRefs(next)}
            charARefId={charARefId}
            setCharARefId={setCharARefId}
            charBRefId={charBRefId}
            setCharBRefId={setCharBRefId}
            work={work}
            setWork={(patch) => setWork((prev) => ({ ...prev, ...patch }))}
            cameraPresetKey={cameraPresetKey}
            setCameraPresetKey={setCameraPresetKey}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            batchCount={batchCount}
            setBatchCount={setBatchCount}
            prompt={work.actionText}
            setPrompt={(v) => setWork((prev) => ({ ...prev, actionText: v }))}
            onGenerate={() => handleGenerate()}
            generating={gen.running}
          />
        </aside>

        {/* 우측: 출력 패널 + (고급) 피규어 맵/최종 프롬프트 */}
        <section className="space-y-4">
          {editImagePath && (
            <NoticeBar tone="info" onClose={() => setEditImagePath(null)}>
              {t("studio.output.edit_mode_note", "이미지 수정 모드 — 선택한 이미지를 원본으로 다시 생성합니다.")}
            </NoticeBar>
          )}

          <StudioOutputPanel
            tenantId={tenantId}
            lineItems={lineItems}
            running={gen.running || gen.row?.status === "queued" || gen.row?.status === "running"}
            pendingCount={batchCount}
            statusRow={gen.row ? { status: gen.row.status, error_message: gen.row.error_message } : null}
            lockedSeeds={lockedSeeds}
            onToggleLock={toggleLock}
            compareIds={compareIds}
            onToggleCompare={toggleCompare}
            onClearLine={() => {
              setLineItems([]);
              setCompareIds([]);
              setLockedSeeds({});
            }}
            onUseAsReference={(it) => void useAsReference(it)}
            onEditImage={(it) => void editImage(it)}
            onSetAsPanel={panelId ? setAsPanel : null}
            onVaryRest={() => handleGenerate({ keepLocks: true })}
          />

          <div className="rounded-3xl bg-card p-5 shadow-toss">
            <h2 className="mb-3 text-sm font-bold">{t("studio.panels.figure_map")}</h2>
            {figureMap.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                {t("studio.labels.figure_hint")}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {figureMap.map((f) => (
                  <div key={f.figNo} className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary text-[10px] font-black text-primary-foreground">
                      {f.figNo}
                    </span>
                    <span className="truncate text-xs font-medium">{f.label}</span>
                  </div>
                ))}
              </div>
            )}
            {studioFigures.contextRefs.length > 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                {t("studio.context_refs", {
                  defaultValue: "컨텍스트로만 사용: {{list}}",
                  list: studioFigures.contextRefs
                    .map((r) => `@image${refs.findIndex((x) => x.id === r.id) + 1}`)
                    .join(", "),
                })}
              </p>
            )}
          </div>

          <div className="rounded-3xl bg-card p-5 shadow-toss">
            <h2 className="mb-3 text-sm font-bold">{t("studio.panels.final_prompt")}</h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px]">
                {rawMode ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                    {t("studio.labels.raw_badge", "Raw · sent as-is")}
                  </span>
                ) : isEdited ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {t("studio.labels.edited_badge", "Edited")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {t("studio.labels.auto_generated", "Auto-generated")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <label className="mr-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rawMode}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setRawMode(on);
                      if (on && !rawPrompt) setRawPrompt(effectivePrompt);
                      setPromptEditMode(false);
                    }}
                    className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                  />
                  {t("studio.labels.raw_mode", "Send raw prompt")}
                </label>
                {rawMode ? null : promptEditMode ? (
                  <Button
                    type="button" size="sm" variant="ghost"
                    onClick={() => setPromptEditMode(false)}
                    className="h-7 rounded-lg text-[11px]"
                  >
                    {t("studio.labels.done_editing", "Done")}
                  </Button>
                ) : (
                  <Button
                    type="button" size="sm" variant="ghost"
                    onClick={() => {
                      setEditedPrompt(effectivePrompt);
                      setPromptEditMode(true);
                    }}
                    className="h-7 rounded-lg text-[11px]"
                  >
                    {t("studio.labels.edit_prompt", "Edit")}
                  </Button>
                )}
                {!rawMode && isEdited && (
                  <Button
                    type="button" size="sm" variant="ghost"
                    onClick={resetEditedPrompt}
                    className="h-7 rounded-lg text-[11px] text-muted-foreground"
                  >
                    {t("studio.labels.reset_prompt", "Reset")}
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              rows={10}
              readOnly={!rawMode && !promptEditMode}
              value={effectivePrompt}
              onChange={(e) => (rawMode ? setRawPrompt(e.target.value) : setEditedPrompt(e.target.value))}
              placeholder={rawMode ? t("studio.labels.raw_placeholder", "Type the exact prompt to send to Seedream.") : undefined}
              maxLength={4000}
              className={`min-h-[240px] resize-y rounded-xl font-mono text-xs leading-relaxed ${
                promptEditMode
                  ? "border-primary/50 bg-background"
                  : isEdited
                  ? "border-amber-300 bg-amber-50/40"
                  : "bg-muted/50"
              }`}
            />

            {promptEditMode && (
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "studio.labels.edit_hint",
                  "Manual edits stay locked — controls won't override until you Reset.",
                )}
              </p>
            )}
            {showTranslated && translated && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-primary">
                    {t("studio.labels.translation", "Translation")}
                    {" · "}
                    {/[\u3131-\uD79D]/.test(effectivePrompt) ? "EN" : "KO"}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(translated).then(() => toast.success(t("common.copied", "Copied")))}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {t("common.copy", "Copy")}
                  </button>
                </div>
                <Textarea
                  rows={8}
                  readOnly
                  value={translated}
                  className="resize-none rounded-xl border-primary/30 bg-primary/5 font-mono text-xs leading-relaxed"
                />
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {t("studio.labels.words", { count: effectivePrompt.trim().split(/\s+/).filter(Boolean).length })}
                {" · "}
                <span className={overLimit ? "font-semibold text-destructive" : ""}>
                  {effectivePrompt.length}/4000
                </span>
              </span>
              {!rawMode && built.warnings.length > 0 && !isEdited && (
                <div className="text-right text-amber-600">
                  {built.warnings.map((w) => (
                    <div key={w}>{(WARN as Record<string, string>)[w] || w}</div>
                  ))}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleTranslate}
              disabled={translating || !effectivePrompt}
              className="h-10 w-full rounded-xl text-sm font-semibold"
            >
              {translating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Languages className="mr-2 h-4 w-4" />
              )}
              {translating
                ? t("studio.labels.translating", "Translating…")
                : translated
                ? showTranslated
                  ? t("studio.labels.hide_translation", "Hide translation")
                  : t("studio.labels.show_translation", "Show translation")
                : /[\u3131-\uD79D]/.test(effectivePrompt)
                ? t("studio.labels.translate_to_en", "Translate to English")
                : t("studio.labels.translate_to_ko", "Translate to Korean")}
            </Button>
            <Button
              onClick={() => handleGenerate()}
              disabled={gen.running}
              className="h-12 w-full rounded-xl bg-primary text-[15px] font-bold text-primary-foreground shadow-toss hover:bg-primary/90"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {gen.running ? t("common.generating_image") : t("common.generate")}
            </Button>

          </div>
          </div>
        </section>
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
  const stepBg = "bg-card";

  return (
    <section
      className={
        "relative flex flex-col overflow-hidden rounded-3xl transition-all duration-300 ease-out lg:h-[calc(100vh-13rem)] lg:min-h-[520px] " +
        stepBg +
        " " +
        (className ?? "")
      }
    >
      <div className="flex items-center gap-2 rounded-t-3xl border-b border-border/60 bg-gradient-to-b from-white/45 to-transparent px-5 py-4">
        <IconBadge size="sm">{step}</IconBadge>
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 [scrollbar-width:thin]">
        {children}
      </div>
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
  const { t } = useTranslation();
  const cls =
    tone === "warn"
      ? "border-amber-300/50 bg-amber-50 text-amber-800"
      : "border-primary/20 bg-primary-soft text-primary";
  return (
    <div className={`flex items-start justify-between gap-2 rounded-2xl border px-4 py-3 text-sm ${cls}`}>
      <span>{children}</span>
      {onClose && (
        <IconTooltip label={t("common.dismiss")}>
          <button onClick={onClose} aria-label={t("common.dismiss")} className="shrink-0 rounded-full p-1 hover:bg-black/5">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </IconTooltip>
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
  const { t } = useTranslation();
  const items = cfg[sheet] ?? [];
  const displayLabel = (it: { label_en?: string; label_ko: string }) =>
    (it.label_en && it.label_en.trim()) || it.label_ko;
  return (
    <div className="space-y-2">
      <Label className="text-[15px] font-bold text-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-xl bg-muted/50">
          <SelectValue placeholder={items.length === 0 ? t("studio.labels.empty") : t("studio.labels.select")} />
        </SelectTrigger>
        <SelectContent>
          {items.length === 0 ? (
            <SelectItem value={value} disabled>
              {t("studio.labels.no_presets_loaded")}
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

/* ---------- S3: Preset Gallery (visual cards) ---------- */

function PresetGallery({
  label, sheet, cfg, value, onChange, variant,
}: {
  label: string;
  sheet: string;
  cfg: Record<string, PresetItem[]>;
  value: string;
  onChange: (v: string) => void;
  /** chip = compact pill row, card = rectangle w/ preview, face = emoji-first square */
  variant: "chip" | "card" | "face";
}) {
  const { t } = useTranslation();
  const items = cfg[sheet] ?? [];
  const displayLabel = (it: PresetItem) => (it.label_en && it.label_en.trim()) || it.label_ko;

  if (items.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-[15px] font-bold text-foreground">{label}</Label>
        <div className="rounded-xl border border-dashed border-border p-3 text-center text-[12px] text-muted-foreground">
          {t("studio.labels.no_presets_loaded")}
        </div>
      </div>
    );
  }

  if (variant === "chip") {
    return (
      <div className="space-y-2">
        <Label className="text-[15px] font-bold text-foreground">{label}</Label>
        <div className="flex flex-wrap gap-2">
          {items.map((it) => {
            const active = it.id === value;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onChange(it.id)}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition " +
                  (active
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-muted/50 text-foreground hover:border-primary/40")
                }
              >
                <span aria-hidden className="inline-flex">
                  {iconForPreset(sheet, it.id, "h-4 w-4")}
                </span>
                {displayLabel(it)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // card / face → grid of tiles with prominent icon label + text
  const cols = variant === "face" ? "grid-cols-5" : "grid-cols-4";
  return (
    <div className="space-y-2">
      <Label className="text-[15px] font-bold text-foreground">{label}</Label>
      <div className={`grid ${cols} gap-2`}>
        {items.map((it) => {
          const active = it.id === value;
          const hasPreview = Boolean(it.preview_path);
          const iconEl = variant === "face"
            ? iconForEmotion(it.id, "h-4 w-4")
            : iconForCamera(sheet, it.id, "h-4 w-4");
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onChange(it.id)}
              title={displayLabel(it)}
              aria-pressed={active}
              className={
                "group relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border p-2 transition " +
                (active
                  ? "border-primary bg-primary-soft/40 ring-1 ring-primary/40"
                  : "border-border bg-muted/40 hover:border-primary/40 hover:bg-muted/60")
              }
            >
              {hasPreview && (
                <img
                  src={it.preview_path!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-90 group-hover:opacity-100"
                />
              )}

              <span
                className={
                  "relative z-10 inline-grid h-7 w-7 place-items-center rounded-lg transition " +
                  (hasPreview
                    ? "bg-background/85 text-foreground shadow-sm backdrop-blur"
                    : "bg-primary-soft text-primary group-hover:bg-primary-soft/80")
                }
                aria-hidden
              >
                {iconEl}
              </span>

              <span
                className={
                  "relative z-10 max-w-full truncate rounded px-1 text-[15px] font-bold leading-tight " +
                  (hasPreview
                    ? "bg-background/80 text-foreground shadow-sm backdrop-blur"
                    : "text-foreground")
                }
              >
                {displayLabel(it)}
              </span>
            </button>

          );
        })}
      </div>
    </div>
  );
}

function iconForPreset(sheet: string, id: string, cls = "h-4 w-4") {
  if (sheet.startsWith("Emotion")) return iconForEmotion(id, cls);
  return iconForCamera(sheet, id, cls);
}

function iconForEmotion(id: string, cls = "h-7 w-7") {
  const m: Record<string, ReactNode> = {
    EMO_000: <Meh className={cls} />,
    EMO_001: <Smile className={cls} />,
    EMO_002: <Smile className={cls} />,
    EMO_003: <Laugh className={cls} />,
    EMO_004: <Frown className={cls} />,
    EMO_005: <Angry className={cls} />,
    EMO_006: <Annoyed className={cls} />,
    EMO_007: <AlertCircle className={cls} />,
    EMO_008: <Smile className={cls} />,
    EMO_009: <Heart className={cls} />,
    EMO_010: <Moon className={cls} />,
    EMO_011: <Zap className={cls} />,
    EMO_012: <Frown className={cls} />,
    EMO_013: <Brain className={cls} />,
    EMO_014: <Ghost className={cls} />,
    EMO_015: <Snowflake className={cls} />,
  };
  return m[id] ?? <Drama className={cls} />;
}

const CAMERA_ANGLE_ICONS: Record<string, (cls: string) => ReactNode> = {
  CAM_A_000: (c) => <Sparkles className={c} />,          // auto
  CAM_A_001: (c) => <Eye className={c} />,               // eye
  CAM_A_002: (c) => <ArrowUpFromLine className={c} />,   // low
  CAM_A_003: (c) => <ArrowDownFromLine className={c} />, // high
  CAM_A_004: (c) => <RotateCw className={c} />,          // dutch
  CAM_A_005: (c) => <ArrowDown className={c} />,         // birdseye
  CAM_A_006: (c) => <ArrowUp className={c} />,           // wormseye
  CAM_A_007: (c) => <ArrowDownRight className={c} />,    // slight-high
  CAM_A_008: (c) => <ArrowUpRight className={c} />,      // slight-low
};

const CAMERA_DISTANCE_ICONS: Record<string, (cls: string) => ReactNode> = {
  CAM_D_000: (c) => <Sparkles className={c} />,      // auto
  CAM_D_001: (c) => <Focus className={c} />,         // close
  CAM_D_002: (c) => <Scan className={c} />,          // medium
  CAM_D_003: (c) => <Expand className={c} />,        // full
  CAM_D_004: (c) => <Aperture className={c} />,      // extreme-close
  CAM_D_005: (c) => <UserCircle2 className={c} />,   // bust
  CAM_D_006: (c) => <User className={c} />,          // cowboy
  CAM_D_007: (c) => <Maximize2 className={c} />,     // wide
  CAM_D_008: (c) => <Ruler className={c} />,         // extreme-wide
};

const CAMERA_POSITION_ICONS: Record<string, (cls: string) => ReactNode> = {
  CAM_P_000: (c) => <Sparkles className={c} />,       // auto
  CAM_P_001: (c) => <Video className={c} />,          // front
  CAM_P_002: (c) => <ArrowLeftRight className={c} />, // side
  CAM_P_003: (c) => <RotateCcw className={c} />,      // back
  CAM_P_004: (c) => <ArrowUpRight className={c} />,   // 3q-front
  CAM_P_005: (c) => <ArrowDownRight className={c} />, // 3q-back
  CAM_P_006: (c) => <Users className={c} />,          // ots-a
  CAM_P_007: (c) => <Users className={c} />,          // ots-b
  CAM_P_008: (c) => <Eye className={c} />,            // pov
};

const POSE_STRENGTH_ICONS: Record<string, (cls: string) => ReactNode> = {
  POS_000: (c) => <Sparkles className={c} />,   // auto
  POS_001: (c) => <ChevronDown className={c} />,// loose
  POS_002: (c) => <Sliders className={c} />,    // balanced
  POS_003: (c) => <ChevronUp className={c} />,  // strict
  POS_004: (c) => <Target className={c} />,     // exact
};

const BG_STRENGTH_ICONS: Record<string, (cls: string) => ReactNode> = {
  BGS_000: (c) => <Sparkles className={c} />,
  BGS_001: (c) => <Cloud className={c} />,
  BGS_002: (c) => <Sliders className={c} />,
  BGS_003: (c) => <Target className={c} />,
};

const BODY_SOURCE_ICONS: Record<string, (cls: string) => ReactNode> = {
  BOD_000: (c) => <Sparkles className={c} />,
  BOD_001: (c) => <ImageIcon className={c} />,
  BOD_002: (c) => <PersonStanding className={c} />,
  BOD_003: (c) => <Minimize2 className={c} />,
  BOD_004: (c) => <User className={c} />,
  BOD_005: (c) => <Gauge className={c} />,
  BOD_006: (c) => <ChevronDown className={c} />,
  BOD_007: (c) => <ChevronUp className={c} />,
};

const BG_STYLE_ICONS: Record<string, (cls: string) => ReactNode> = {
  BGST_000: (c) => <Sparkles className={c} />,
  BGST_001: (c) => <Home className={c} />,
  BGST_002: (c) => <TreePine className={c} />,
  BGST_003: (c) => <Square className={c} />,
  BGST_004: (c) => <Building2 className={c} />,
  BGST_005: (c) => <Moon className={c} />,
  BGST_006: (c) => <Coffee className={c} />,
  BGST_007: (c) => <GraduationCap className={c} />,
  BGST_008: (c) => <Bed className={c} />,
  BGST_009: (c) => <TreePine className={c} />,
  BGST_010: (c) => <Waves className={c} />,
  BGST_011: (c) => <Sun className={c} />,
  BGST_012: (c) => <Castle className={c} />,
  BGST_013: (c) => <Cpu className={c} />,
  BGST_014: (c) => <Flower2 className={c} />,
  BGST_015: (c) => <CloudRain className={c} />,
  BGST_016: (c) => <CloudSnow className={c} />,
  BGST_017: (c) => <Camera className={c} />,
};

const STYLE_FINISH_ICONS: Record<string, (cls: string) => ReactNode> = {
  STY_000: (c) => <Sparkles className={c} />,
  STY_001: (c) => <Layers className={c} />,
  STY_002: (c) => <Palette className={c} />,
  STY_003: (c) => <Brush className={c} />,
  STY_004: (c) => <Brush className={c} />,
  STY_005: (c) => <Palette className={c} />,
  STY_006: (c) => <ImageIcon className={c} />,
  STY_007: (c) => <PenTool className={c} />,
  STY_008: (c) => <Pencil className={c} />,
  STY_009: (c) => <Grid3x3 className={c} />,
  STY_010: (c) => <Film className={c} />,
  STY_011: (c) => <Circle className={c} />,
  STY_012: (c) => <Compass className={c} />,
};

function iconForCamera(sheet: string, id: string, cls = "h-7 w-7") {
  const pick = (m: Record<string, (c: string) => ReactNode>, fallback: ReactNode) =>
    (m[id] ? m[id](cls) : fallback);
  if (sheet.startsWith("CameraAngle"))
    return pick(CAMERA_ANGLE_ICONS, <Triangle className={cls} />);
  if (sheet.startsWith("CameraDistance"))
    return pick(CAMERA_DISTANCE_ICONS, <Focus className={cls} />);
  if (sheet.startsWith("CameraPosition"))
    return pick(CAMERA_POSITION_ICONS, <Video className={cls} />);
  if (sheet.startsWith("PoseStrength"))
    return pick(POSE_STRENGTH_ICONS, <PersonStanding className={cls} />);
  if (sheet.startsWith("BgStrength"))
    return pick(BG_STRENGTH_ICONS, <Sliders className={cls} />);
  if (sheet.startsWith("BgStyle"))
    return pick(BG_STYLE_ICONS, <ImageIcon className={cls} />);
  if (sheet.startsWith("BodySource"))
    return pick(BODY_SOURCE_ICONS, <PersonStanding className={cls} />);
  if (sheet.startsWith("StyleFinish"))
    return pick(STYLE_FINISH_ICONS, <Palette className={cls} />);
  if (sheet.startsWith("Pose"))
    return <PersonStanding className={cls} />;
  return <Sparkles className={cls} />;
}


/* ---------- S4: Variation grid + compare + set-as-panel ---------- */

function VariationGrid({
  results, lockedSeeds, compareIds, onToggleLock, onToggleCompare, onSetAsPanel,
}: {
  results: Array<{ id: string; seq: number; storage_path: string | null; thumb_path: string | null; seed: number | null }>;
  lockedSeeds: Record<number, number>;
  compareIds: string[];
  onToggleLock: (seq: number, seed: number | null) => void;
  onToggleCompare: (id: string) => void;
  onSetAsPanel: ((resultId: string) => void) | null;
}) {
  const { t } = useTranslation();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxItems = results.map((r) => ({
    id: r.id,
    bucket: "generation-outputs",
    path: r.storage_path ?? r.thumb_path,
    alt: `#${r.seq + 1}`,
  }));
  return (
    <div className={results.length === 1 ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
      {lightboxIndex !== null && (
        <ImageLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
      {results.map((r) => {
        const locked = r.seed != null && lockedSeeds[r.seq] === r.seed;
        const inCompare = compareIds.includes(r.id);
        return (
          <div
            key={r.id}
            className={
              "group relative overflow-hidden rounded-xl border bg-muted/30 " +
              (inCompare ? "border-primary ring-2 ring-primary" : "border-border")
            }
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(results.findIndex((x) => x.id === r.id))}
              aria-label={t("lightbox.open")}
              className="block w-full cursor-zoom-in"
            >
              <SignedImage
                bucket="generation-outputs"
                path={r.storage_path ?? r.thumb_path}
                alt={`variant-${r.seq}`}
                className="h-auto w-full object-contain"
              />
            </button>

            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1.5">
              <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-white">
                #{r.seq + 1} · seed {r.seed ?? "—"}
              </span>
              <div className="flex items-center gap-1">
                <IconTooltip label={t("lightbox.open")}>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(results.findIndex((x) => x.id === r.id))}
                    aria-label={t("lightbox.open")}
                    className="grid h-6 w-6 place-items-center rounded-md bg-black/60 text-white hover:bg-black/80"
                  >
                    <Maximize2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                </IconTooltip>
                <ImageDownloadMenu
                  bucket="generation-outputs"
                  path={r.storage_path}
                  baseName={`variant-${r.seq + 1}`}
                  size="icon"
                  variant="secondary"
                  buttonClassName="h-6 w-6"
                />
                <IconTooltip label={locked ? t("common.unlock_seed") : t("common.lock_seed")}>
                  <button
                    type="button"
                    onClick={() => onToggleLock(r.seq, r.seed)}
                    aria-label={locked ? t("common.unlock_seed") : t("common.lock_seed")}
                    disabled={r.seed == null}
                    className={
                      "grid h-6 w-6 place-items-center rounded-md text-white shadow-sm " +
                      (locked ? "bg-primary" : "bg-black/60 hover:bg-black/80 disabled:opacity-40")
                    }
                  >
                    {locked ? <Lock className="h-3 w-3" aria-hidden="true" /> : <Unlock className="h-3 w-3" aria-hidden="true" />}
                  </button>
                </IconTooltip>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={() => onToggleCompare(r.id)}
                className={
                  "flex-1 rounded-md px-2 py-1 text-[10px] font-bold " +
                  (inCompare ? "bg-primary text-primary-foreground" : "bg-white/90 text-foreground hover:bg-white")
                }
              >
                <GitCompare className="mr-1 inline h-3 w-3" />
                {inCompare ? t("studio.labels.selected") : t("studio.labels.compare")}
              </button>
              {onSetAsPanel && (
                <button
                  type="button"
                  onClick={() => onSetAsPanel(r.id)}
                  className="flex-1 rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground hover:opacity-90"
                >
                  {t("studio.labels.use_for_panel")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompareView({
  results, ids, onClose,
}: {
  results: Array<{ id: string; seq: number; storage_path: string | null; thumb_path: string | null; seed: number | null }>;
  ids: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [a, b] = ids.map((id) => results.find((r) => r.id === id)).filter(Boolean) as typeof results;
  if (!a || !b) return null;
  return (
    <div className="rounded-2xl border border-primary/40 bg-primary-soft/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-primary">{t("studio.labels.compare_title")}</span>
        <IconTooltip label={t("common.close_compare")}>
          <button onClick={onClose} aria-label={t("common.close_compare")} className="rounded-full p-1 hover:bg-black/5">
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </IconTooltip>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[a, b].map((r, idx) => (
          <div key={r.id} className="space-y-1">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">
              {idx === 0 ? "A" : "B"} · seed {r.seed ?? "—"}
            </div>
            <SignedImage
              bucket="generation-outputs"
              path={r.storage_path ?? r.thumb_path}
              alt={`compare-${idx}`}
              className="aspect-square w-full rounded-lg border border-border object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

