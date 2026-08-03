import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCharacters } from "@/hooks/useCharacters";
import { useVideoGeneration } from "@/hooks/useVideoGeneration";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { SignedImage } from "@/components/SignedImage";
import { IconBadge } from "@/components/icon-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Film,
  ImagePlus,
  X,
  Loader2,
  Sparkles,
  Download,
  ArrowLeft,
  Clock,
  Ratio,
  MonitorPlay,
  Camera,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/video")({
  component: VideoStudioPage,
  head: () => ({
    meta: [
      { title: "Video Studio · pilotstudio" },
      {
        name: "description",
        content: "Generate character-driven short videos with Seedance from a reference frame and a motion prompt.",
      },
      { property: "og:title", content: "Video Studio · pilotstudio" },
      {
        property: "og:description",
        content: "Seedance video generation workspace inside pilotstudio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"] as const;
const RESOLUTIONS = ["480p", "720p", "1080p"] as const;
const DURATIONS = [3, 5, 10] as const;

const MOTION_PRESETS: Array<{ id: string; label: string; text: string }> = [
  { id: "MOV_ORBIT", label: "Orbit", text: "the camera slowly orbits around the subject" },
  { id: "MOV_DOLLY_IN", label: "Dolly in", text: "the camera slowly dollies in toward the subject" },
  { id: "MOV_DOLLY_OUT", label: "Dolly out", text: "the camera slowly pulls back away from the subject" },
  { id: "MOV_PAN", label: "Pan", text: "the camera pans smoothly from left to right" },
  { id: "MOV_TILT_UP", label: "Tilt up", text: "the camera tilts upward revealing the scene" },
  { id: "MOV_HANDHELD", label: "Handheld", text: "subtle handheld camera shake follows the action" },
  { id: "MOV_STATIC", label: "Static", text: "the camera stays completely static" },
  { id: "MOV_ZOOM", label: "Zoom", text: "a slow zoom emphasizes the subject" },
];

const AMBIENCE_PRESETS: Array<{ id: string; label: string; text: string }> = [
  { id: "AMB_WIND", label: "Wind", text: "hair and clothing move gently in the wind" },
  { id: "AMB_RAIN", label: "Rain", text: "light rain falls with soft splashes" },
  { id: "AMB_SNOW", label: "Snow", text: "snow drifts slowly through the air" },
  { id: "AMB_LIGHT", label: "Light shift", text: "warm light gradually shifts across the scene" },
  { id: "AMB_DUST", label: "Dust", text: "dust particles float in the light beams" },
  { id: "AMB_CROWD", label: "Crowd", text: "background crowd moves naturally out of focus" },
];

function VideoStudioPage() {
  const { t } = useTranslation();
  const { tenantId } = useTenant();
  const { data: characters = [] } = useCharacters();
  const gen = useVideoGeneration(tenantId);

  const [firstFrame, setFirstFrame] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [actionText, setActionText] = useState("");
  const [motionIds, setMotionIds] = useState<string[]>([]);
  const [ambienceIds, setAmbienceIds] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("720p");
  const [duration, setDuration] = useState<number>(5);
  const [cameraFixed, setCameraFixed] = useState(false);
  const [seedLocked, setSeedLocked] = useState(false);
  const [seed, setSeed] = useState<string>("");
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);

  const builtPrompt = useMemo(() => {
    const parts: string[] = [];
    if (actionText.trim()) parts.push(actionText.trim());
    const motion = MOTION_PRESETS.filter((m) => motionIds.includes(m.id)).map((m) => m.text);
    const ambience = AMBIENCE_PRESETS.filter((a) => ambienceIds.includes(a.id)).map((a) => a.text);
    parts.push(...motion, ...ambience);
    if (parts.length === 0) return "";
    return parts.join(", ") + ".";
  }, [actionText, motionIds, ambienceIds]);

  const finalPrompt = editedPrompt ?? builtPrompt;
  const mode: "t2v" | "i2v" = firstFrame ? "i2v" : "t2v";

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleUpload(file: File) {
    if (!tenantId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${tenantId}/video-refs/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("character-refs")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setFirstFrame(path);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate() {
    if (!finalPrompt.trim()) {
      toast.error(t("video.errors.empty_prompt"));
      return;
    }
    try {
      await gen.run({
        workLabel: "V1",
        mode,
        finalPrompt,
        rawPrompt: builtPrompt || undefined,
        promptEdited: editedPrompt != null && editedPrompt !== builtPrompt,
        aspectRatio,
        resolution,
        durationSeconds: duration,
        cameraFixed,
        seed: seedLocked && seed.trim() ? Number(seed) : null,
        imagePaths: firstFrame ? [firstFrame] : [],
        options: { motionIds, ambienceIds, actionText },
      });
      toast.success(t("video.toast.started"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="px-4 py-5 sm:px-6">
      <StudioSwitcher active="video" />
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Film className="h-3.5 w-3.5" /> Seedance
        </span>
      </div>


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* 1. Reference frame */}
        <Panel step={1} title={t("video.panels.reference")}>
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {t("video.reference_hint")}
            </p>

            {firstFrame ? (
              <div className="relative overflow-hidden rounded-2xl border border-border">
                <SignedImage
                  bucket="character-refs"
                  path={firstFrame}
                  alt={t("video.panels.reference")}
                  className="h-48 w-full object-cover"
                />
                <button
                  onClick={() => setFirstFrame(null)}
                  aria-label={t("common.dismiss")}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/85 text-foreground shadow"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-[13px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
                {t("video.upload_frame")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </label>
            )}

            <div>
              <Label className="text-[13px] font-bold">{t("video.from_characters")}</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {characters.slice(0, 12).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => c.primary_path && setFirstFrame(c.primary_path)}
                    className={
                      "overflow-hidden rounded-xl border transition-colors " +
                      (firstFrame === c.primary_path
                        ? "border-primary ring-2 ring-primary/25"
                        : "border-border hover:border-primary/40")
                    }
                    title={c.display_name}
                  >
                    <SignedImage
                      bucket="character-refs"
                      path={c.primary_path}
                      alt={c.display_name}
                      className="h-16 w-full object-cover"
                    />
                    <span className="block truncate px-1.5 py-1 text-[11px] font-semibold">
                      {c.display_name}
                    </span>
                  </button>
                ))}
              </div>
              {characters.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{t("video.no_characters")}</p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 px-3 py-2 text-[12px] font-semibold text-muted-foreground">
              {mode === "i2v" ? t("video.mode_i2v") : t("video.mode_t2v")}
            </div>
          </div>
        </Panel>

        {/* 2. Motion */}
        <Panel step={2} title={t("video.panels.motion")}>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-bold">{t("video.action_label")}</Label>
              <Textarea
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder={t("video.action_placeholder")}
                className="min-h-[96px] rounded-2xl text-[14px]"
              />
            </div>

            <PresetGroup
              title={t("video.camera_motion")}
              icon={<Camera className="h-4 w-4" />}
              items={MOTION_PRESETS}
              selected={motionIds}
              onToggle={(id) => toggle(motionIds, setMotionIds, id)}
            />
            <PresetGroup
              title={t("video.ambience")}
              icon={<Sparkles className="h-4 w-4" />}
              items={AMBIENCE_PRESETS}
              selected={ambienceIds}
              onToggle={(id) => toggle(ambienceIds, setAmbienceIds, id)}
            />
          </div>
        </Panel>

        {/* 3. Output settings + prompt */}
        <Panel step={3} title={t("video.panels.output")}>
          <div className="space-y-5">
            <ChipRow
              title={t("video.aspect_ratio")}
              icon={<Ratio className="h-4 w-4" />}
              options={RATIOS.map((r) => ({ id: r, label: r }))}
              value={aspectRatio}
              onChange={setAspectRatio}
              disabled={mode === "i2v"}
              disabledHint={t("video.ratio_from_image")}
            />
            <ChipRow
              title={t("video.resolution")}
              icon={<MonitorPlay className="h-4 w-4" />}
              options={RESOLUTIONS.map((r) => ({ id: r, label: r }))}
              value={resolution}
              onChange={(v) => setResolution(v as (typeof RESOLUTIONS)[number])}
            />
            <ChipRow
              title={t("video.duration")}
              icon={<Clock className="h-4 w-4" />}
              options={DURATIONS.map((d) => ({ id: String(d), label: `${d}s` }))}
              value={String(duration)}
              onChange={(v) => setDuration(Number(v))}
            />

            <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
              <Label className="text-[13px] font-bold">{t("video.camera_fixed")}</Label>
              <Switch checked={cameraFixed} onCheckedChange={setCameraFixed} />
            </div>

            <div className="space-y-2 rounded-2xl border border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-bold">{t("video.seed_lock")}</Label>
                <Switch checked={seedLocked} onCheckedChange={setSeedLocked} />
              </div>
              {seedLocked && (
                <Input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="123456"
                  className="rounded-xl text-[13px]"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px] font-bold">{t("video.final_prompt")}</Label>
              <Textarea
                value={finalPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                placeholder={t("video.final_prompt_placeholder")}
                className="min-h-[110px] rounded-2xl font-mono text-[12.5px]"
              />
              {editedPrompt != null && (
                <button
                  onClick={() => setEditedPrompt(null)}
                  className="text-[12px] font-semibold text-primary"
                >
                  {t("video.reset_prompt")}
                </button>
              )}
            </div>
          </div>
        </Panel>

        {/* 4. Result */}
        <Panel step={4} title={t("video.panels.result")}>
          <div className="space-y-4">
            <Button
              onClick={handleGenerate}
              disabled={gen.running || !finalPrompt.trim()}
              className="h-12 w-full rounded-2xl text-[15px] font-bold"
            >
              {gen.running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("video.generating")}
                </>
              ) : (
                <>
                  <Film className="mr-2 h-4 w-4" />
                  {t("video.generate")}
                </>
              )}
            </Button>

            {gen.running && (
              <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
                {t("video.generating_hint")}
              </div>
            )}

            {gen.error && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                {gen.error}
              </div>
            )}

            {gen.row?.results?.map((r) => (
              <VideoResultCard key={r.id} path={r.storage_path} />
            ))}

            {!gen.running && !gen.row && !gen.error && (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {t("video.result_empty")}
              </p>
            )}
          </div>
        </Panel>
      </div>
    </main>
  );
}

function VideoResultCard({ path }: { path: string }) {
  const { t } = useTranslation();
  const url = useSignedUrl("generation-outputs", path, 300);
  if (!url) {
    return <div className="h-44 animate-pulse rounded-2xl bg-muted" />;
  }
  return (
    <div className="space-y-2">
      <video src={url} controls playsInline className="w-full rounded-2xl border border-border" />
      <Button asChild variant="outline" size="sm" className="w-full rounded-xl text-xs font-semibold">
        <a href={url} download>
          <Download className="mr-1 h-3.5 w-3.5" />
          {t("video.download")}
        </a>
      </Button>
    </div>
  );
}

function PresetGroup({
  title,
  icon,
  items,
  selected,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => {
          const active = selected.includes(it.id);
          return (
            <button
              key={it.id}
              onClick={() => onToggle(it.id)}
              className={
                "rounded-xl border px-3 py-2 text-left text-[13px] font-bold transition-colors " +
                (active
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-background text-foreground/80 hover:border-primary/40")
              }
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChipRow({
  title,
  icon,
  options,
  value,
  onChange,
  disabled,
  disabledHint,
}: {
  title: string;
  icon: React.ReactNode;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      <div className={"flex flex-wrap gap-2 " + (disabled ? "opacity-50" : "")}>
        {options.map((o) => (
          <button
            key={o.id}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={
              "rounded-xl border px-3 py-1.5 text-[13px] font-bold transition-colors " +
              (value === o.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-background text-foreground/80 hover:border-primary/40")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
      {disabled && disabledHint && (
        <p className="text-[12px] text-muted-foreground">{disabledHint}</p>
      )}
    </div>
  );
}

function Panel({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative flex flex-col overflow-hidden rounded-3xl bg-card lg:h-[calc(100vh-13rem)] lg:min-h-[520px]">
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
