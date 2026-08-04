import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { checkVideoModelHealth } from "@/lib/video-health.functions";

type VideoHealth = {
  checkedAt: string;
  canGenerate: boolean;
  models: Array<{
    id: string;
    label: string;
    provider: "lovable" | "seedance" | "replicate";
    status: "available" | "unavailable" | "unknown";
    detail: string;
  }>;
};

import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCharacters } from "@/hooks/useCharacters";
import { useVideoGeneration } from "@/hooks/useVideoGeneration";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { SignedImage } from "@/components/SignedImage";
import { StudioSwitcher } from "@/components/studio-switcher";
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
  RefreshCw,
  Sparkles,
  Download,
  Clock,
  Ratio,
  MonitorPlay,
  Camera,
  Crop,
  Compass,
  Gauge,
  Sun,
  Palette,
  Info,
  Video,
  Wand2,
  Trash2,
} from "lucide-react";
import { analyzeReferences, type ReferenceBrief } from "@/lib/reference-analysis.functions";
import { extractVideoFrames } from "@/lib/videoFrames";
import { MentionTextarea } from "@/components/MentionTextarea";

/** An uploaded reference image or video that can be mentioned in the prompt with @name. */
type MediaAsset = {
  id: string;
  name: string;
  kind: "image" | "video";
  /** thumbnail / frame used as an actual model input */
  coverPath: string;
  /** all frames kept for AI study (images have one) */
  framePaths: string[];
  role: "first" | "last" | "style";
  /** optional user note describing how this media should be used */
  note: string;
};

const ROLES: Array<{ id: MediaAsset["role"]; label: string; hint: string }> = [
  { id: "first", label: "First frame", hint: "the video starts from this image" },
  { id: "last", label: "Last frame", hint: "the video ends on this image" },
  { id: "style", label: "Style only", hint: "used as look / motion reference" },
];

export const Route = createFileRoute("/_authenticated/video")({
  component: VideoStudioPage,
  head: () => ({
    meta: [
      { title: "Video Studio · pilotstudio" },
      {
        name: "description",
        content:
          "Generate character-driven short videos with Replicate from a reference frame and a motion prompt.",
      },
      { property: "og:title", content: "Video Studio · pilotstudio" },
      {
        property: "og:description",
        content: "Replicate video generation workspace inside pilotstudio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"] as const;
const RESOLUTIONS = ["480p", "720p", "1080p"] as const;
const DURATIONS = [3, 5, 10, 12] as const;

type Preset = { id: string; label: string; text: string };

const MOTION_PRESETS: Preset[] = [
  { id: "MOV_ORBIT", label: "Orbit", text: "the camera slowly orbits around the subject" },
  {
    id: "MOV_DOLLY_IN",
    label: "Dolly in",
    text: "the camera slowly dollies in toward the subject",
  },
  {
    id: "MOV_DOLLY_OUT",
    label: "Dolly out",
    text: "the camera slowly pulls back away from the subject",
  },
  { id: "MOV_PAN_L", label: "Pan left", text: "the camera pans smoothly to the left" },
  { id: "MOV_PAN_R", label: "Pan right", text: "the camera pans smoothly to the right" },
  { id: "MOV_TILT_UP", label: "Tilt up", text: "the camera tilts upward revealing the scene" },
  { id: "MOV_TILT_DOWN", label: "Tilt down", text: "the camera tilts downward across the scene" },
  {
    id: "MOV_TRACK",
    label: "Tracking",
    text: "the camera tracks alongside the subject as it moves",
  },
  { id: "MOV_CRANE", label: "Crane up", text: "the camera cranes upward for a rising overview" },
  {
    id: "MOV_HANDHELD",
    label: "Handheld",
    text: "subtle handheld camera shake follows the action",
  },
  { id: "MOV_STATIC", label: "Static", text: "the camera stays completely static" },
  { id: "MOV_ZOOM_IN", label: "Zoom in", text: "a slow zoom in emphasizes the subject" },
  { id: "MOV_ZOOM_OUT", label: "Zoom out", text: "a slow zoom out reveals the surroundings" },
  {
    id: "MOV_PUSH",
    label: "Push through",
    text: "the camera pushes forward through the foreground elements",
  },
  { id: "MOV_WHIP", label: "Whip pan", text: "a fast whip pan transitions across the scene" },
  { id: "MOV_ARC", label: "Arc", text: "the camera arcs around the subject in a wide curve" },
];

const SHOT_PRESETS: Preset[] = [
  { id: "SHOT_ECU", label: "Extreme close-up", text: "extreme close-up shot" },
  { id: "SHOT_CU", label: "Close-up", text: "close-up shot" },
  { id: "SHOT_MS", label: "Medium shot", text: "medium shot" },
  { id: "SHOT_COWBOY", label: "Cowboy shot", text: "cowboy shot framed from the thighs up" },
  { id: "SHOT_FULL", label: "Full body", text: "full body shot" },
  { id: "SHOT_WIDE", label: "Wide", text: "wide establishing shot" },
  { id: "SHOT_EWIDE", label: "Extreme wide", text: "extreme wide landscape shot" },
  { id: "SHOT_OTS", label: "Over shoulder", text: "over-the-shoulder shot" },
  { id: "SHOT_POV", label: "POV", text: "first person point of view shot" },
  { id: "SHOT_TWO", label: "Two shot", text: "two shot framing both characters" },
];

const ANGLE_PRESETS: Preset[] = [
  { id: "ANG_EYE", label: "Eye level", text: "eye level angle" },
  { id: "ANG_LOW", label: "Low angle", text: "low angle looking up at the subject" },
  { id: "ANG_HIGH", label: "High angle", text: "high angle looking down at the subject" },
  { id: "ANG_BIRD", label: "Bird's eye", text: "bird's eye top-down view" },
  { id: "ANG_WORM", label: "Worm's eye", text: "worm's eye ground level view" },
  { id: "ANG_DUTCH", label: "Dutch tilt", text: "dutch tilted frame" },
  { id: "ANG_PROFILE", label: "Profile", text: "side profile framing" },
  { id: "ANG_BACK", label: "From behind", text: "framed from behind the subject" },
];

const SPEED_PRESETS: Preset[] = [
  { id: "SPD_SLOW", label: "Slow motion", text: "slow motion" },
  { id: "SPD_NORMAL", label: "Normal", text: "" },
  { id: "SPD_FAST", label: "Fast paced", text: "fast paced energetic motion" },
  { id: "SPD_TIME", label: "Timelapse", text: "timelapse speed ramp" },
];

const LIGHT_PRESETS: Preset[] = [
  { id: "LGT_GOLDEN", label: "Golden hour", text: "warm golden hour lighting" },
  { id: "LGT_BLUE", label: "Blue hour", text: "cool blue hour lighting" },
  { id: "LGT_RIM", label: "Rim light", text: "strong rim backlighting" },
  { id: "LGT_SOFT", label: "Soft daylight", text: "soft diffused daylight" },
  { id: "LGT_HARD", label: "Hard shadow", text: "hard directional light with deep shadows" },
  { id: "LGT_NEON", label: "Neon night", text: "neon night lighting with colored reflections" },
  { id: "LGT_CANDLE", label: "Candlelight", text: "flickering candlelight" },
  { id: "LGT_MOON", label: "Moonlight", text: "cool moonlight" },
  { id: "LGT_STUDIO", label: "Studio", text: "clean studio softbox lighting" },
  { id: "LGT_SIL", label: "Silhouette", text: "silhouette against a bright background" },
];

const STYLE_PRESETS: Preset[] = [
  { id: "STY_CINE", label: "Cinematic", text: "cinematic film look with shallow depth of field" },
  { id: "STY_ANIME", label: "Anime", text: "2D anime animation style" },
  { id: "STY_3D", label: "3D animation", text: "stylized 3D animated film look" },
  { id: "STY_WATER", label: "Watercolor", text: "soft watercolor illustration style" },
  { id: "STY_NOIR", label: "Noir B&W", text: "high contrast black and white noir" },
  { id: "STY_VHS", label: "VHS retro", text: "retro VHS analog grain look" },
  { id: "STY_DOC", label: "Documentary", text: "natural documentary realism" },
  { id: "STY_DREAM", label: "Dreamy bokeh", text: "dreamy soft focus with heavy bokeh" },
];

const AMBIENCE_PRESETS: Preset[] = [
  { id: "AMB_WIND", label: "Wind", text: "hair and clothing move gently in the wind" },
  { id: "AMB_RAIN", label: "Rain", text: "light rain falls with soft splashes" },
  { id: "AMB_SNOW", label: "Snow", text: "snow drifts slowly through the air" },
  { id: "AMB_LIGHT", label: "Light shift", text: "warm light gradually shifts across the scene" },
  { id: "AMB_DUST", label: "Dust", text: "dust particles float in the light beams" },
  { id: "AMB_CROWD", label: "Crowd", text: "background crowd moves naturally out of focus" },
  { id: "AMB_FOG", label: "Fog", text: "low fog rolls slowly through the scene" },
  { id: "AMB_LEAVES", label: "Falling leaves", text: "leaves drift down through the frame" },
  { id: "AMB_EMBER", label: "Embers", text: "glowing embers float upward" },
  { id: "AMB_WATER", label: "Water ripples", text: "water ripples and reflections shimmer" },
  { id: "AMB_FIREFLY", label: "Fireflies", text: "fireflies blink softly around the subject" },
  { id: "AMB_SMOKE", label: "Smoke", text: "thin smoke curls through the air" },
];

function VideoStudioPage() {
  const { t } = useTranslation();
  const { tenantId } = useTenant();
  const { data: characters = [] } = useCharacters();
  const gen = useVideoGeneration(tenantId);

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [actionText, setActionText] = useState("");
  const [negativeText, setNegativeText] = useState("");
  const [motionIds, setMotionIds] = useState<string[]>([]);
  const [ambienceIds, setAmbienceIds] = useState<string[]>([]);
  const [shotId, setShotId] = useState<string | null>(null);
  const [angleId, setAngleId] = useState<string | null>(null);
  const [speedId, setSpeedId] = useState<string | null>(null);
  const [lightIds, setLightIds] = useState<string[]>([]);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("720p");
  const [duration, setDuration] = useState<number>(5);
  const [cameraFixed, setCameraFixed] = useState(false);
  const [seedLocked, setSeedLocked] = useState(false);
  const [seed, setSeed] = useState<string>("");
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
  const provider = "replicate" as const;

  // --- Reference study (learn from the mentioned media) ---
  const analyzeFn = useServerFn(analyzeReferences);
  const [analyzing, setAnalyzing] = useState(false);
  const [brief, setBrief] = useState<ReferenceBrief | null>(null);
  const [applyBrief, setApplyBrief] = useState(true);

  /** media actually mentioned with @ inside the prompt */
  const mentioned = useMemo(() => {
    const names = new Set(
      Array.from(actionText.matchAll(/(^|\s)@([A-Za-z0-9_-]+)/g)).map((m) => m[2].toLowerCase()),
    );
    return assets.filter((a) => names.has(a.name.toLowerCase()));
  }, [actionText, assets]);

  const activeAssets = mentioned;

  const firstFrame = mentioned.find((a) => a.role === "first")?.coverPath ?? null;
  const lastFrame = mentioned.find((a) => a.role === "last")?.coverPath ?? null;
  const studyPaths = activeAssets.flatMap((a) => a.framePaths).slice(0, 8);
  const studyHasVideo = activeAssets.some((a) => a.kind === "video");

  // 모델 가용 상태 점검
  const checkHealth = useServerFn(checkVideoModelHealth);
  const [health, setHealth] = useState<VideoHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const res = (await checkHealth({ data: undefined })) as VideoHealth;
      setHealth(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setHealthLoading(false);
    }
  }

  /** Replace "@name" tokens with wording the video model understands. */
  const resolveMentions = (text: string) =>
    text.replace(/(^|\s)@([A-Za-z0-9_-]+)/g, (full, sp: string, name: string) => {
      const a = assets.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (!a) return full;
      const description =
        a.note.trim() ||
        (a.kind === "video"
          ? "the referenced motion and visual style"
          : "the referenced subject and visual style");
      const label =
        a.role === "first"
          ? `${description} shown in the supplied first frame`
          : a.role === "last"
            ? `${description} shown in the supplied last frame`
            : `${description}, used only as a style and motion guide`;
      return `${sp}${label}`;
    });

  const builtPrompt = useMemo(() => {
    const parts: string[] = [];
    const one = (list: Preset[], id: string | null) =>
      id ? (list.find((p) => p.id === id)?.text ?? "") : "";
    const many = (list: Preset[], ids: string[]) =>
      list.filter((p) => ids.includes(p.id)).map((p) => p.text);

    const action = resolveMentions(actionText).trim();
    if (action) parts.push(action);
    parts.push(one(SHOT_PRESETS, shotId));
    parts.push(one(ANGLE_PRESETS, angleId));
    parts.push(...many(MOTION_PRESETS, motionIds));
    parts.push(one(SPEED_PRESETS, speedId));
    parts.push(...many(LIGHT_PRESETS, lightIds));
    parts.push(...many(AMBIENCE_PRESETS, ambienceIds));
    parts.push(one(STYLE_PRESETS, styleId));

    const cleaned = parts.map((p) => p.trim()).filter(Boolean);
    const suffix = applyBrief ? (brief?.promptSuffix ?? "").trim() : "";
    if (cleaned.length === 0 && !suffix) return "";
    return (suffix ? [...cleaned, suffix] : cleaned).join(", ") + ".";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    actionText,
    assets,
    shotId,
    angleId,
    motionIds,
    speedId,
    lightIds,
    ambienceIds,
    styleId,
    brief,
    applyBrief,
  ]);

  const negativePrompt = useMemo(
    () =>
      [negativeText.trim(), applyBrief ? (brief?.negative ?? "").trim() : ""]
        .filter(Boolean)
        .join(", "),
    [negativeText, brief, applyBrief],
  );

  const finalPrompt = editedPrompt ?? builtPrompt;
  const mode: "t2v" | "i2v" = firstFrame ? "i2v" : "t2v";

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function uploadBlob(blob: Blob, name: string) {
    const path = `${tenantId}/video-refs/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${name}`;
    const { error } = await supabase.storage
      .from("character-refs")
      .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
    if (error) throw error;
    return path;
  }

  function nextName(taken: MediaAsset[], kind: MediaAsset["kind"]) {
    const base = kind === "video" ? "video" : "img";
    let n = 1;
    while (taken.some((a) => a.name === `${base}${n}`)) n++;
    return `${base}${n}`;
  }

  /** Add reference media. A video is stored as one card whose frames are sampled in the browser. */
  async function handleAddMedia(files: FileList) {
    if (!tenantId) return;
    setUploading(true);
    try {
      const added: MediaAsset[] = [];
      for (const file of Array.from(files)) {
        if (assets.length + added.length >= 6) break;
        if (file.type.startsWith("video/")) {
          const frames = await extractVideoFrames(file, 3);
          const paths: string[] = [];
          let i = 0;
          for (const frame of frames) paths.push(await uploadBlob(frame, `frame-${i++}.jpg`));
          if (paths.length === 0) continue;
          added.push({
            id: crypto.randomUUID(),
            name: nextName([...assets, ...added], "video"),
            kind: "video",
            coverPath: paths[0],
            framePaths: paths,
            role: "style",
            note: "",
          });
        } else if (file.type.startsWith("image/")) {
          const ext = file.name.split(".").pop()?.toLowerCase() || "png";
          const path = await uploadBlob(file, `ref.${ext}`);
          added.push({
            id: crypto.randomUUID(),
            name: nextName([...assets, ...added], "image"),
            kind: "image",
            coverPath: path,
            framePaths: [path],
            role: assets.some((a) => a.role === "first") ? "style" : "first",
            note: "",
          });
        }
      }
      if (added.length === 0) {
        toast.error("Pick an image or video file.");
        return;
      }
      setAssets((prev) => [...prev, ...added].slice(0, 6));
      toast.success(
        `Added ${added.map((a) => "@" + a.name).join(", ")} — mention them in the prompt.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function updateAsset(id: string, patch: Partial<MediaAsset>) {
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const next = { ...a, ...patch };
        return next;
      }),
    );
    // only one asset can hold each frame slot
    if (patch.role === "first" || patch.role === "last") {
      setAssets((prev) =>
        prev.map((a) => (a.id !== id && a.role === patch.role ? { ...a, role: "style" } : a)),
      );
    }
  }

  function addCharacterAsset(path: string, label: string) {
    if (assets.some((a) => a.coverPath === path)) return;
    setAssets((prev) =>
      [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: nextName(prev, "image"),
          kind: "image" as const,
          coverPath: path,
          framePaths: [path],
          role: prev.some((a) => a.role === "first") ? ("style" as const) : ("first" as const),
          note: label,
        },
      ].slice(0, 6),
    );
  }

  async function handleAnalyze() {
    if (studyPaths.length === 0) return;
    setAnalyzing(true);
    try {
      const res = (await analyzeFn({
        data: {
          imagePaths: studyPaths,
          intent: actionText.trim() || undefined,
          hasVideoFrames: studyHasVideo,
        },
      })) as ReferenceBrief;
      setBrief(res);
      setApplyBrief(true);
      setEditedPrompt(null);
      toast.success("Reference brief ready — it is now part of your prompt.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate() {
    if (!finalPrompt.trim()) {
      toast.error(t("video.errors.empty_prompt"));
      return;
    }
    try {
      const imagePaths = [firstFrame, firstFrame ? lastFrame : null].filter((p): p is string =>
        Boolean(p),
      );
      await gen.run({
        workLabel: "V1",
        provider,
        mode,

        finalPrompt,
        negativePrompt: negativePrompt || undefined,
        rawPrompt: builtPrompt || undefined,
        promptEdited: editedPrompt != null && editedPrompt !== builtPrompt,
        aspectRatio,
        resolution,
        durationSeconds: duration,
        cameraFixed,
        seed: seedLocked && seed.trim() ? Number(seed) : null,
        imagePaths,
        options: {
          referenceStudyPaths: studyPaths,
          referenceHasVideo: studyHasVideo,
          referenceBrief: applyBrief ? brief : null,
          referenceRoles: mentioned.map((asset) => ({
            name: asset.name,
            kind: asset.kind,
            role: asset.role,
            note: asset.note.trim() || null,
            directlySuppliedToModel: asset.role === "first" || asset.role === "last",
          })),

          motionIds,
          ambienceIds,
          shotId,
          angleId,
          speedId,
          lightIds,
          styleId,
          actionText,
        },
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
          <Film className="h-3.5 w-3.5" /> Replicate
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* 1. Reference media library */}
        <Panel step={1} title="Reference media">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
              <div className="flex items-start gap-2 text-[13px] font-semibold text-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Upload anything you want to reference
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                Every image or video you add becomes a named card such as{" "}
                <span className="font-bold text-foreground">@img1</span> or{" "}
                <span className="font-bold text-foreground">@video1</span>. In the prompt (panel 2)
                type <span className="font-bold text-foreground">@</span> to mention them freely —
                exactly like Dreamina or Playground. A video is kept as one card; its frames are
                sampled in the background for the AI study.
              </p>
            </div>

            <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border text-[13px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
              {uploading ? "Reading media…" : "Add reference images or video"}
              <span className="text-[11px] font-normal">Up to 6 cards · jpg, png, mp4</span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void handleAddMedia(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            {assets.length > 0 && (
              <div className="space-y-3">
                {assets.map((a) => (
                  <div key={a.id} className="space-y-2 rounded-2xl border border-border p-3">
                    <div className="flex gap-3">
                      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-border">
                        <SignedImage
                          bucket="character-refs"
                          path={a.coverPath}
                          alt={a.name}
                          className="h-20 w-28 object-cover"
                        />
                        {a.kind === "video" && (
                          <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-background/85 px-1.5 py-0.5 text-[10px] font-bold">
                            <Video className="h-3 w-3" />
                            {a.framePaths.length}f
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-bold text-primary">
                            @{a.name}
                          </span>
                          <button
                            onClick={() => setAssets((prev) => prev.filter((x) => x.id !== a.id))}
                            aria-label={`Remove ${a.name}`}
                            className="grid h-6 w-6 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <Input
                          value={a.note}
                          onChange={(e) => updateAsset(a.id, { note: e.target.value })}
                          placeholder="What is this? e.g. main character in a red coat"
                          className="h-8 rounded-xl text-[12.5px]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {ROLES.map((r) => (
                        <button
                          key={r.id}
                          title={r.hint}
                          onClick={() => updateAsset(a.id, { role: r.id })}
                          className={
                            "rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors " +
                            (a.role === r.id
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40")
                          }
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {characters.length > 0 && (
              <div>
                <Label className="text-[13px] font-bold">{t("video.from_characters")}</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {characters.slice(0, 12).map((c) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        c.primary_path && addCharacterAsset(c.primary_path, c.display_name)
                      }
                      className="overflow-hidden rounded-xl border border-border transition-colors hover:border-primary/40"
                      title={`Add ${c.display_name} as reference media`}
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
              </div>
            )}

            {/* Optional AI study of the referenced media */}
            {assets.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-border px-4 py-4">
                <div className="flex items-start gap-2">
                  <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <Label className="text-[13px] font-bold">Optional: study the references</Label>
                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                      Reads the mentioned media and appends look / lighting / motion wording to the
                      final prompt. Leave it off if you prefer to write everything yourself.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAnalyze}
                    disabled={analyzing || studyPaths.length === 0}
                    className="flex-1 rounded-xl text-[12.5px] font-bold"
                  >
                    {analyzing ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {analyzing
                      ? "Studying…"
                      : `Study ${mentioned.length > 0 ? "mentioned" : "all"} media`}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    aria-label="Clear reference media"
                    onClick={() => {
                      setAssets([]);
                      setBrief(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {brief && (
                  <div className="space-y-2 rounded-2xl bg-muted/50 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold">Reference brief</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] text-muted-foreground">Use in prompt</span>
                        <Switch checked={applyBrief} onCheckedChange={setApplyBrief} />
                      </div>
                    </div>
                    {(
                      [
                        ["Subject", brief.subject],
                        ["Style", brief.style],
                        ["Lighting", brief.lighting],
                        ["Camera", brief.camera],
                        ["Motion", brief.motion],
                        ["Avoid", brief.negative],
                      ] as const
                    )
                      .filter(([, v]) => Boolean(v))
                      .map(([k, v]) => (
                        <p key={k} className="text-[11.5px] leading-relaxed text-muted-foreground">
                          <span className="font-bold text-foreground">{k}:</span> {v}
                        </p>
                      ))}
                  </div>
                )}
              </div>
            )}

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
              <MentionTextarea
                value={actionText}
                onChange={(v) => setActionText(v)}
                items={assets.map((a) => ({
                  name: a.name,
                  coverPath: a.coverPath,
                  hint:
                    (a.kind === "video" ? "video · " : "image · ") +
                    (ROLES.find((r) => r.id === a.role)?.label ?? ""),
                }))}
                placeholder={
                  assets.length
                    ? "Type @ to reference your uploaded media, then describe the shot freely."
                    : t("video.action_placeholder")
                }
                className="min-h-[120px] rounded-2xl text-[14px]"
              />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Type <span className="font-bold text-foreground">@</span> to mention uploaded media
                (e.g. “@img1 slowly turns her head and smiles, lighting like @video1”). Mentions
                decide which media is used. First/Last frame cards are sent directly; Style-only
                cards influence the prompt through their note or optional AI study.
              </p>
              {mentioned.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {mentioned.map((a) => (
                    <span
                      key={a.id}
                      className="rounded-full bg-primary-soft px-2.5 py-1 text-[11.5px] font-bold text-primary"
                    >
                      @{a.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px] font-bold">{t("video.negative_label")}</Label>
              <Textarea
                value={negativeText}
                onChange={(e) => setNegativeText(e.target.value)}
                placeholder={t("video.negative_placeholder")}
                className="min-h-[60px] rounded-2xl text-[13px]"
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
              title={t("video.shot_size")}
              icon={<Crop className="h-4 w-4" />}
              items={SHOT_PRESETS}
              selected={shotId ? [shotId] : []}
              onToggle={(id) => setShotId(shotId === id ? null : id)}
            />
            <PresetGroup
              title={t("video.camera_angle")}
              icon={<Compass className="h-4 w-4" />}
              items={ANGLE_PRESETS}
              selected={angleId ? [angleId] : []}
              onToggle={(id) => setAngleId(angleId === id ? null : id)}
            />
            <PresetGroup
              title={t("video.speed")}
              icon={<Gauge className="h-4 w-4" />}
              items={SPEED_PRESETS}
              selected={speedId ? [speedId] : []}
              onToggle={(id) => setSpeedId(speedId === id ? null : id)}
            />
            <PresetGroup
              title={t("video.lighting")}
              icon={<Sun className="h-4 w-4" />}
              items={LIGHT_PRESETS}
              selected={lightIds}
              onToggle={(id) => toggle(lightIds, setLightIds, id)}
            />
            <PresetGroup
              title={t("video.style")}
              icon={<Palette className="h-4 w-4" />}
              items={STYLE_PRESETS}
              selected={styleId ? [styleId] : []}
              onToggle={(id) => setStyleId(styleId === id ? null : id)}
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
            <div className="space-y-2 rounded-2xl border border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-[13px] font-bold">{t("video.health_title")}</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={runHealthCheck}
                  disabled={healthLoading}
                  className="rounded-xl text-[12px] font-bold"
                >
                  {healthLoading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Gauge className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t("video.health_check")}
                </Button>
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {t("video.provider_hint")}
              </p>
              {health && (
                <div className="space-y-2 pt-1">
                  {health.models.map((m) => (
                    <div key={m.id} className="rounded-xl bg-muted/50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-bold">{m.label}</span>
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-[11px] font-bold " +
                            (m.status === "available"
                              ? "bg-primary/15 text-primary"
                              : m.status === "unavailable"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-foreground/10 text-muted-foreground")
                          }
                        >
                          {t(`video.health_status_${m.status}`)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                        {m.detail}
                      </p>
                    </div>
                  ))}
                  <p className="px-1 text-[11.5px] text-muted-foreground">
                    {new Date(health.checkedAt).toLocaleString()} ·{" "}
                    {health.canGenerate ? t("video.health_ready") : t("video.health_blocked")}
                  </p>
                </div>
              )}
            </div>

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

            {gen.recoveryNotice && (
              <div className="flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3 text-[13px] text-foreground">
                <RefreshCw
                  className={"mt-0.5 h-4 w-4 shrink-0 text-primary " + (gen.running ? "animate-spin" : "")}
                  aria-hidden="true"
                />
                <div>
                  <p className="font-bold">Automatic recovery</p>
                  <p className="mt-0.5 leading-relaxed text-muted-foreground">
                    {gen.recoveryNotice}
                  </p>
                </div>
              </div>
            )}

            {gen.error && (
              <div className="space-y-1 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                {(() => {
                  const lines = gen.error.split("\n").filter((l) => l.trim());
                  const [head, ...rest] = lines;
                  return (
                    <>
                      <p className="font-bold">{head}</p>
                      {rest.map((l, i) => (
                        <p
                          key={i}
                          className={
                            l.startsWith("(raw:")
                              ? "break-all text-[11px] opacity-60"
                              : "leading-relaxed opacity-90"
                          }
                        >
                          {l}
                        </p>
                      ))}
                    </>
                  );
                })()}
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
      <Button
        asChild
        variant="outline"
        size="sm"
        className="w-full rounded-xl text-xs font-semibold"
      >
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
