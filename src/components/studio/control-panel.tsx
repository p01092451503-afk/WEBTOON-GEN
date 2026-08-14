import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ReferenceManager } from "@/components/studio/reference-manager";
import { CR_PER_IMAGE, type StudioRef } from "@/lib/studioRefs";
import { PROMPT_MAX_CHARS, type PresetItem, type PromptConfig, type WorkInput } from "@/lib/promptEngine";

const ASPECT_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"];

/** 카메라 프리셋(auto-fill) — 값 자체는 presets 테이블 id 를 참조만 한다 */
const CAMERA_PRESETS: { key: string; fallback: string; angle: string; distance: string; focus: string }[] = [
  { key: "dialogue_close", fallback: "대화 클로즈업", angle: "CAM_A_001", distance: "CAM_D_001", focus: "FOC_001" },
  { key: "intro_full", fallback: "전신 소개컷", angle: "CAM_A_001", distance: "CAM_D_003", focus: "FOC_000" },
  { key: "tense_low", fallback: "긴장감 로우앵글", angle: "CAM_A_002", distance: "CAM_D_002", focus: "FOC_001" },
  { key: "high_wide", fallback: "하이앵글 와이드", angle: "CAM_A_003", distance: "CAM_D_007", focus: "FOC_000" },
];

export type ControlPanelProps = {
  tenantId: string | null;
  cfg: PromptConfig;
  refs: StudioRef[];
  setRefs: (next: StudioRef[]) => void;
  charARefId: string | null;
  setCharARefId: (v: string | null) => void;
  charBRefId: string | null;
  setCharBRefId: (v: string | null) => void;
  work: WorkInput;
  setWork: (patch: Partial<WorkInput>) => void;
  cameraPresetKey: string | null;
  setCameraPresetKey: (v: string | null) => void;
  aspectRatio: string;
  setAspectRatio: (v: string) => void;
  batchCount: number;
  setBatchCount: (v: number) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  onGenerate: () => void;
  generating: boolean;
};

export function StudioControlPanel(props: ControlPanelProps) {
  const { t } = useTranslation();
  const { cfg, work, setWork, refs, prompt, setPrompt } = props;
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const availablePresets = useMemo(
    () =>
      CAMERA_PRESETS.filter(
        (p) =>
          has(cfg, "CameraAngle", p.angle) &&
          has(cfg, "CameraDistance", p.distance) &&
          has(cfg, "FocusTarget", p.focus),
      ),
    [cfg],
  );

  function insertMention(mention: string) {
    const el = promptRef.current;
    const token = `${mention} `;
    if (!el) {
      setPrompt(`${prompt}${prompt && !prompt.endsWith(" ") ? " " : ""}${token}`);
      return;
    }
    const start = el.selectionStart ?? prompt.length;
    const end = el.selectionEnd ?? prompt.length;
    const next = prompt.slice(0, start) + token + prompt.slice(end);
    setPrompt(next.slice(0, PROMPT_MAX_CHARS));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function applyCameraPreset(key: string) {
    const p = CAMERA_PRESETS.find((x) => x.key === key);
    if (!p) return;
    props.setCameraPresetKey(key);
    setWork({ cameraAngleId: p.angle, cameraDistanceId: p.distance, focusTargetId: p.focus });
  }

  /** 사용자가 개별 값을 바꾸면 프리셋 해제 */
  function setCameraField(patch: Partial<WorkInput>) {
    props.setCameraPresetKey(null);
    setWork(patch);
  }

  const credits = props.batchCount * CR_PER_IMAGE;
  const canGenerate = prompt.trim().length > 0 && !props.generating;

  return (
    <div className="space-y-6">
      {/* 1. 레퍼런스 이미지 */}
      <ReferenceManager
        tenantId={props.tenantId}
        refs={refs}
        onChange={props.setRefs}
        onMention={insertMention}
        charARefId={props.charARefId}
        charBRefId={props.charBRefId}
      />

      <Divider />

      {/* 2. 포즈 강도 / 배경 강도 */}
      <PresetRadios
        label={t("studio.labels.pose_strength")}
        sheet="PoseStrength"
        cfg={cfg}
        value={work.poseStrengthId}
        onChange={(v) => setWork({ poseStrengthId: v })}
      />
      <PresetRadios
        label={t("studio.labels.bg_strength")}
        sheet="BgStrength"
        cfg={cfg}
        value={work.bgStrengthId}
        onChange={(v) => setWork({ bgStrengthId: v })}
      />

      <Divider />

      {/* 3. 감정 / 스타일 / 배경 스타일 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PresetSelectField label={t("studio.labels.emotion")} sheet="Emotion" cfg={cfg} value={work.emotionId} onChange={(v) => setWork({ emotionId: v })} />
        <PresetSelectField label={t("studio.labels.style_finish")} sheet="StyleFinish" cfg={cfg} value={work.styleFinishId} onChange={(v) => setWork({ styleFinishId: v })} />
        <PresetSelectField label={t("studio.labels.bg_style")} sheet="BgStyle" cfg={cfg} value={work.bgStyleId} onChange={(v) => setWork({ bgStyleId: v })} />
      </div>

      <Divider />

      {/* 4. 카메라 */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold">{t("studio.camera.title", "카메라")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <RefSelect
            label={`${t("studio.labels.character_a")} (@image)`}
            refs={refs}
            value={props.charARefId}
            onChange={props.setCharARefId}
          />
          <RefSelect
            label={`${t("studio.labels.character_b")} (@image)`}
            refs={refs}
            value={props.charBRefId}
            onChange={props.setCharBRefId}
          />
          <PresetSelectField label={t("studio.labels.camera_angle")} sheet="CameraAngle" cfg={cfg} value={work.cameraAngleId} onChange={(v) => setCameraField({ cameraAngleId: v })} />
          <PresetSelectField label={t("studio.labels.camera_distance")} sheet="CameraDistance" cfg={cfg} value={work.cameraDistanceId} onChange={(v) => setCameraField({ cameraDistanceId: v })} />
          <PresetSelectField label={t("studio.labels.focus")} sheet="FocusTarget" cfg={cfg} value={work.focusTargetId} onChange={(v) => setCameraField({ focusTargetId: v })} />
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground">
              {t("studio.camera.preset", "카메라 프리셋")}
            </Label>
            <Select
              value={props.cameraPresetKey ?? "__none"}
              onValueChange={(v) => (v === "__none" ? props.setCameraPresetKey(null) : applyCameraPreset(v))}
            >
              <SelectTrigger className="h-10 rounded-xl bg-muted/50">
                <SelectValue placeholder={t("studio.labels.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t("studio.labels.none")}</SelectItem>
                {availablePresets.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {t(`studio.camera.presets.${p.key}`, { defaultValue: p.fallback })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <PresetSelectField
            label={`${t("studio.labels.camera_position")} A`}
            sheet="CameraPosition"
            cfg={cfg}
            value={work.cameraPositionId}
            onChange={(v) => setCameraField({ cameraPositionId: v })}
          />
        </div>
      </section>

      <Divider />

      {/* 5. 의상 / 체형 / 비율 / 개수 */}
      <div className="grid grid-cols-2 gap-3">
        <PresetSelectField label={t("studio.labels.costume")} sheet="CostumeMode" cfg={cfg} value={work.costumeModeId} onChange={(v) => setWork({ costumeModeId: v })} />
        <PresetSelectField label={t("studio.labels.body_source")} sheet="BodySource" cfg={cfg} value={work.bodySourceId} onChange={(v) => setWork({ bodySourceId: v })} />
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground">{t("studio.labels.aspect_ratio")}</Label>
          <Select value={props.aspectRatio} onValueChange={props.setAspectRatio}>
            <SelectTrigger className="h-10 rounded-xl bg-muted/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground">{t("studio.labels.batch")}</Label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => props.setBatchCount(n)}
                aria-pressed={props.batchCount === n}
                className={
                  "h-10 flex-1 rounded-xl border text-sm font-bold transition " +
                  (props.batchCount === n
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-primary/40")
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Divider />

      {/* 6. 프롬프트 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">{t("studio.prompt.title", "프롬프트")}</h3>
          <span className="text-[11px] text-muted-foreground">
            {prompt.length}/{PROMPT_MAX_CHARS}
          </span>
        </div>
        {refs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {refs.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => insertMention(`@image${i + 1}`)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-semibold hover:border-primary/50 hover:text-primary"
              >
                <AtSign className="h-3 w-3" aria-hidden />
                image{i + 1}
              </button>
            ))}
          </div>
        )}
        <Textarea
          ref={promptRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX_CHARS))}
          maxLength={PROMPT_MAX_CHARS}
          rows={6}
          placeholder={t("studio.labels.action_placeholder")}
          className="min-h-[140px] resize-y rounded-2xl bg-muted/50 text-sm leading-relaxed"
        />
        <p className="text-[11px] font-semibold text-muted-foreground">
          {t("studio.credits_estimate", { defaultValue: "예상 소진 {{count}} CR", count: credits })}
        </p>
      </section>

      {/* 7. 생성 버튼 */}
      <Button
        type="button"
        onClick={props.onGenerate}
        disabled={!canGenerate}
        className="h-12 w-full rounded-full bg-primary text-[15px] font-bold text-primary-foreground shadow-toss hover:bg-primary/90"
      >
        {props.generating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" aria-hidden />
        )}
        {props.generating ? t("common.generating_image") : t("studio.make_image", "이미지 만들기")}
      </Button>
    </div>
  );
}

function has(cfg: PromptConfig, sheet: string, id: string) {
  return (cfg[sheet] ?? []).some((i) => i.id === id);
}

function displayLabel(it: PresetItem) {
  return (it.label_ko && it.label_ko.trim()) || it.label_en;
}

function Divider() {
  return <div className="h-px bg-border" />;
}

function PresetRadios({
  label,
  sheet,
  cfg,
  value,
  onChange,
}: {
  label: string;
  sheet: string;
  cfg: PromptConfig;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const items = cfg[sheet] ?? [];
  return (
    <section className="space-y-2">
      <Label className="text-sm font-bold text-foreground">{label}</Label>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-3 text-center text-[12px] text-muted-foreground">
          {t("studio.labels.no_presets_loaded")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {items.map((it) => {
            const active = it.id === value;
            return (
              <button
                key={it.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(it.id)}
                className={
                  "h-10 truncate rounded-xl border px-2 text-[12px] font-semibold transition " +
                  (active
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-primary/40")
                }
              >
                {displayLabel(it)}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PresetSelectField({
  label,
  sheet,
  cfg,
  value,
  onChange,
}: {
  label: string;
  sheet: string;
  cfg: PromptConfig;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const items = cfg[sheet] ?? [];
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-xl bg-muted/50">
          <SelectValue placeholder={t("studio.labels.select")} />
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

function RefSelect({
  label,
  refs,
  value,
  onChange,
}: {
  label: string;
  refs: StudioRef[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
      <Select value={value ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
        <SelectTrigger className="h-10 rounded-xl bg-muted/50">
          <SelectValue placeholder={t("studio.labels.select")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">{t("studio.labels.none")}</SelectItem>
          {refs.map((r, i) => (
            <SelectItem key={r.id} value={r.id}>
              @image{i + 1}
              {r.sourceName ? ` · ${r.sourceName}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
