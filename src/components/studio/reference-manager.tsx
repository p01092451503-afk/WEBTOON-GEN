import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { useCharacters } from "@/hooks/useCharacters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImagePlus, Upload, X, AtSign, Users } from "lucide-react";
import {
  MAX_REFS,
  ROLE_TAGS,
  type RoleTag,
  type StudioRef,
} from "@/lib/studioRefs";

export function roleLabel(t: (k: string, d?: string) => string, role: RoleTag) {
  const fallback: Record<RoleTag, string> = {
    character: "캐릭터",
    background: "배경",
    costume: "의상",
    pose: "포즈",
    composition: "구도",
    style: "스타일",
    prop: "소품",
    etc: "기타",
  };
  return t(`studio.roles.${role}`, fallback[role]);
}

export function ReferenceManager({
  tenantId,
  refs,
  onChange,
  onMention,
  charARefId,
  charBRefId,
}: {
  tenantId: string | null;
  refs: StudioRef[];
  onChange: (next: StudioRef[]) => void;
  onMention: (mention: string) => void;
  charARefId: string | null;
  charBRefId: string | null;
}) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const addPaths = useCallback(
    (items: { path: string; sourceName?: string }[]) => {
      const room = MAX_REFS - refs.length;
      if (room <= 0) {
        toast.error(t("studio.refs.max_reached", `레퍼런스는 최대 ${MAX_REFS}개까지 추가할 수 있습니다.`));
        return;
      }
      const next = items.slice(0, room).map((it) => ({
        id: crypto.randomUUID(),
        path: it.path,
        sourceName: it.sourceName,
        roles: ["character"] as RoleTag[],
      }));
      onChange([...refs, ...next]);
    },
    [refs, onChange, t],
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!tenantId || files.length === 0) return;
      const room = MAX_REFS - refs.length;
      if (room <= 0) {
        toast.error(t("studio.refs.max_reached", `레퍼런스는 최대 ${MAX_REFS}개까지 추가할 수 있습니다.`));
        return;
      }
      setUploading(true);
      try {
        const uploaded: { path: string }[] = [];
        for (const file of files.slice(0, room)) {
          if (!file.type.startsWith("image/")) continue;
          const ext = file.name.split(".").pop()?.toLowerCase() || "png";
          const path = `${tenantId}/refs/ref-${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage
            .from("character-refs")
            .upload(path, file, { contentType: file.type });
          if (error) {
            toast.error(t("studio.upload_failed", { msg: error.message }));
            continue;
          }
          uploaded.push({ path });
        }
        if (uploaded.length) addPaths(uploaded);
      } finally {
        setUploading(false);
      }
    },
    [tenantId, refs.length, addPaths, t],
  );

  function updateRef(id: string, patch: Partial<StudioRef>) {
    onChange(refs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRef(id: string) {
    onChange(refs.filter((r) => r.id !== id));
  }
  function toggleRole(ref: StudioRef, role: RoleTag) {
    const roles = ref.roles.includes(role)
      ? ref.roles.filter((x) => x !== role)
      : [...ref.roles, role];
    updateRef(ref.id, { roles });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">
          {t("studio.refs.title", "레퍼런스 이미지")}
          <span className="ml-2 text-xs font-semibold text-muted-foreground">
            {refs.length}/{MAX_REFS}
          </span>
        </h3>
        <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs font-semibold text-primary">
              <Users className="mr-1 h-3.5 w-3.5" />
              {t("studio.refs.from_group", "이미지 그룹에서 선택")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("studio.refs.from_group", "이미지 그룹에서 선택")}</DialogTitle>
            </DialogHeader>
            <GroupPicker
              onPick={(path, name) => {
                addPaths([{ path, sourceName: name }]);
                setGroupOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(Array.from(e.dataTransfer.files));
        }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.length) void uploadFiles(files);
        }}
        tabIndex={0}
        className={
          "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition outline-none " +
          (dragOver ? "border-primary bg-primary-soft/50" : "border-border bg-muted/40 focus:border-primary/50")
        }
      >
        <ImagePlus className="h-5 w-5 text-primary" aria-hidden />
        <p className="text-xs text-muted-foreground">
          {uploading
            ? t("common.uploading")
            : t("studio.refs.dropzone", "이미지를 끌어다 놓거나 붙여넣기 (최대 10개)")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || !tenantId}
          onClick={() => fileInput.current?.click()}
          className="h-8 rounded-full text-xs font-semibold"
        >
          <Upload className="mr-1 h-3.5 w-3.5" />
          {t("studio.refs.upload", "컴퓨터에서 업로드")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void uploadFiles(Array.from(e.target.files ?? []));
            e.currentTarget.value = "";
          }}
        />
      </div>

      {refs.length > 0 && (
        <ul className="space-y-2">
          {refs.map((r, i) => {
            const mention = `@image${i + 1}`;
            const camRole =
              r.id === charARefId ? "A" : r.id === charBRefId ? "B" : null;
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-2.5 shadow-toss-sm">
                <div className="flex gap-3">
                  <SignedImage
                    bucket="character-refs"
                    path={r.path}
                    alt={mention}
                    className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onMention(mention)}
                        className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary-soft/70"
                      >
                        <AtSign className="h-3 w-3" aria-hidden />
                        {mention.slice(1)}
                      </button>
                      {camRole && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {t("studio.refs.cam_char", "카메라 캐릭터")} {camRole}
                        </span>
                      )}
                      {r.sourceName && (
                        <span className="truncate text-[11px] text-muted-foreground">{r.sourceName}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRef(r.id)}
                        aria-label={t("common.remove")}
                        className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ROLE_TAGS.map((role) => {
                        const active = r.roles.includes(role);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => toggleRole(r, role)}
                            aria-pressed={active}
                            className={
                              "rounded-full border px-2 py-0.5 text-[11px] font-semibold transition " +
                              (active
                                ? "border-primary bg-primary-soft text-primary"
                                : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40")
                            }
                          >
                            {roleLabel(t, role)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function GroupPicker({ onPick }: { onPick: (path: string, name: string) => void }) {
  const { t } = useTranslation();
  const { data: characters = [], isLoading } = useCharacters();
  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (characters.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">{t("characters.empty_title")}</p>;
  return (
    <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
      {characters.map((c) => (
        <button
          key={c.id}
          type="button"
          disabled={!c.primary_path}
          onClick={() => c.primary_path && onPick(c.primary_path, c.display_name)}
          className="group space-y-1 rounded-xl border border-border p-1.5 text-left transition hover:border-primary disabled:opacity-40"
        >
          <SignedImage
            bucket="character-refs"
            path={c.primary_path}
            alt={c.display_name}
            className="aspect-square w-full rounded-lg object-cover"
          />
          <span className="block truncate px-0.5 text-[11px] font-semibold">{c.display_name}</span>
        </button>
      ))}
    </div>
  );
}
