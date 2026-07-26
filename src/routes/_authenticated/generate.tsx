import { useEffect, useMemo, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCharacters } from "@/hooks/useCharacters";
import { usePresets } from "@/hooks/usePresets";
import { useGeneration } from "@/hooks/useGeneration";
import { SignedImage } from "@/components/SignedImage";
import { buildFigureMap, buildPrompt, WARN, type WorkInput } from "@/lib/promptEngine";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/_authenticated/generate")({
  component: GeneratePage,
  head: () => ({ meta: [{ title: "생성 · toonpilot" }] }),
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

  // 히스토리에서 넘어온 설정 복원 (sessionStorage: toonpilot:restore)
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
      setRestoredNote(`이전 생성(${r.workLabel ?? "W1"}) 설정을 불러왔습니다.`);
      toast.success("이전 설정이 복원되었습니다.");
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
        toast.error(`업로드 실패: ${error.message}`);
        return;
      }
      const setter = kind === "bg" ? setBgRef : kind === "pose" ? setPoseRef : setStyleRef;
      setter({ path });
    },
    [tenantId],
  );

  async function handleGenerate() {
    if (!charA?.primary_path && !charB?.primary_path) {
      toast.error("Character A 또는 B 를 최소 1개 선택하세요.");
      return;
    }
    // 순서: CharA → CharB → Background → Pose → Style
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
      });
      toast.success("생성 요청 완료");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  const hasPresets = Object.keys(cfg).length > 0;

  return (
    <main className="max-w-[1400px] mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">생성</h1>
        <Link to="/characters" className="text-sm underline text-muted-foreground">
          캐릭터 관리
        </Link>
      </div>

      {!hasPresets && (
        <Alert>
          <AlertDescription className="text-sm">
            프리셋 데이터가 비어 있습니다. presets 테이블에 시드가 필요합니다. (기본 스타일 문장만 사용됨)
          </AlertDescription>
        </Alert>
      )}

      {restoredNote && (
        <Alert>
          <AlertDescription className="text-sm flex items-center justify-between gap-2">
            <span>{restoredNote} (참조 이미지와 캐릭터는 다시 선택해주세요.)</span>
            <button
              onClick={() => setRestoredNote(null)}
              className="text-xs underline text-muted-foreground"
            >
              닫기
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Panel 1: References */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">1. References</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Character A</Label>
              <CharacterPicker value={charAId} onChange={setCharAId} characters={characters} />
            </div>
            <div>
              <Label className="text-xs">Character B</Label>
              <CharacterPicker value={charBId} onChange={setCharBId} characters={characters} />
            </div>
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
          </CardContent>
        </Card>

        {/* Panel 2: Prompt Controls */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">2. Prompt Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <PresetSelect
                label="Pose Strength"
                sheet="PoseStrength"
                cfg={cfg}
                value={work.poseStrengthId}
                onChange={(v) => setWork({ ...work, poseStrengthId: v })}
              />
              <PresetSelect
                label="Bg Strength"
                sheet="BgStrength"
                cfg={cfg}
                value={work.bgStrengthId}
                onChange={(v) => setWork({ ...work, bgStrengthId: v })}
              />
              <PresetSelect
                label="Body Source"
                sheet="BodySource"
                cfg={cfg}
                value={work.bodySourceId}
                onChange={(v) => setWork({ ...work, bodySourceId: v })}
              />
              <PresetSelect
                label="Camera Angle"
                sheet="CameraAngle"
                cfg={cfg}
                value={work.cameraAngleId}
                onChange={(v) => setWork({ ...work, cameraAngleId: v })}
              />
              <PresetSelect
                label="Camera Distance"
                sheet="CameraDistance"
                cfg={cfg}
                value={work.cameraDistanceId}
                onChange={(v) => setWork({ ...work, cameraDistanceId: v })}
              />
              <PresetSelect
                label="Camera Position"
                sheet="CameraPosition"
                cfg={cfg}
                value={work.cameraPositionId}
                onChange={(v) => setWork({ ...work, cameraPositionId: v })}
              />
              <PresetSelect
                label="Focus"
                sheet="FocusTarget"
                cfg={cfg}
                value={work.focusTargetId}
                onChange={(v) => setWork({ ...work, focusTargetId: v })}
              />
              <PresetSelect
                label="Bg Style"
                sheet="BgStyle"
                cfg={cfg}
                value={work.bgStyleId}
                onChange={(v) => setWork({ ...work, bgStyleId: v })}
              />
              <PresetSelect
                label="Costume"
                sheet="CostumeMode"
                cfg={cfg}
                value={work.costumeModeId}
                onChange={(v) => setWork({ ...work, costumeModeId: v })}
              />
              <PresetSelect
                label="Emotion"
                sheet="Emotion"
                cfg={cfg}
                value={work.emotionId}
                onChange={(v) => setWork({ ...work, emotionId: v })}
              />
              <PresetSelect
                label="Style Finish"
                sheet="StyleFinish"
                cfg={cfg}
                value={work.styleFinishId}
                onChange={(v) => setWork({ ...work, styleFinishId: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Action</Label>
              <Textarea
                rows={2}
                value={work.actionText}
                onChange={(e) => setWork({ ...work, actionText: e.target.value })}
                placeholder="예: they hold hands and walk toward the camera"
              />
            </div>
            <div>
              <Label className="text-xs">Direction Memo</Label>
              <Textarea
                rows={2}
                value={work.directionMemo}
                onChange={(e) => setWork({ ...work, directionMemo: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Photopose (실사 포즈)</Label>
              <Switch
                checked={work.isPhotopose}
                onCheckedChange={(v) => setWork({ ...work, isPhotopose: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="4:3">4:3</SelectItem>
                    <SelectItem value="3:4">3:4</SelectItem>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="3:2">3:2</SelectItem>
                    <SelectItem value="2:3">2:3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Batch</Label>
                <Input
                  type="number"
                  min={1}
                  max={4}
                  value={batchCount}
                  onChange={(e) =>
                    setBatchCount(Math.max(1, Math.min(4, Number(e.target.value) || 1)))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel 3: Figure Map */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">3. Figure Map</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {figureMap.length === 0 ? (
              <p className="text-xs text-muted-foreground">참조가 없습니다.</p>
            ) : (
              figureMap.map((f) => (
                <div
                  key={f.figNo}
                  className="flex items-center gap-2 text-xs border rounded px-2 py-1"
                >
                  <Badge variant="outline">Figure {f.figNo}</Badge>
                  <span className="truncate">{f.label}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Panel 4: Final Prompt & Result */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">4. Final Prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={10}
              readOnly
              value={built.prompt}
              className="font-mono text-xs"
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">단어수: {built.wordCount}</span>
              {built.warnings.length > 0 && (
                <div className="text-amber-600 space-y-1">
                  {built.warnings.map((w) => (
                    <div key={w}>{(WARN as Record<string, string>)[w] || w}</div>
                  ))}
                </div>
              )}
            </div>
            <Button className="w-full" onClick={handleGenerate} disabled={gen.running}>
              {gen.running ? "요청 중…" : "Generate"}
            </Button>

            {gen.row && (
              <div className="space-y-2 pt-2 border-t">
                <div className="text-xs flex items-center justify-between">
                  <Badge
                    variant={
                      gen.row.status === "done"
                        ? "default"
                        : gen.row.status === "error"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {gen.row.status}
                  </Badge>
                  <span className="text-muted-foreground truncate">{gen.currentId}</span>
                </div>
                {gen.row.error_message && (
                  <p className="text-xs text-destructive break-all">{gen.row.error_message}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {gen.row.results.map((r) => (
                    <SignedImage
                      key={r.id}
                      bucket="generation-outputs"
                      path={r.storage_path}
                      alt={`result-${r.seq}`}
                      className="rounded border w-full aspect-square object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
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
        <SelectTrigger>
          <SelectValue placeholder="선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">(없음)</SelectItem>
          {characters.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && (
        <SignedImage
          bucket="character-refs"
          path={characters.find((c) => c.id === value)?.primary_path}
          alt="char"
          className="w-full aspect-square object-cover rounded border"
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
    <div>
      <Label className="text-xs">{label}</Label>
      {value ? (
        <div className="space-y-1">
          <SignedImage
            bucket="character-refs"
            path={value.path}
            alt={label}
            className="w-full aspect-square object-cover rounded border"
          />
          <Button variant="outline" size="sm" className="w-full" onClick={onClear}>
            제거
          </Button>
        </div>
      ) : (
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.currentTarget.value = "";
          }}
        />
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
  cfg: Record<string, { id: string; label_ko: string }[]>;
  value: string;
  onChange: (v: string) => void;
}) {
  const items = cfg[sheet] ?? [];
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={items.length === 0 ? "(비어있음)" : "선택"} />
        </SelectTrigger>
        <SelectContent>
          {items.length === 0 ? (
            <SelectItem value={value} disabled>
              (프리셋 없음)
            </SelectItem>
          ) : (
            items.map((it) => (
              <SelectItem key={it.id} value={it.id}>
                {it.label_ko}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
