import { useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Check,
  Download,
  FolderInput,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Wand2,
} from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import {
  useCharacters,
  useCreateCharacter,
  useDeleteCharacter,
  useRenameCharacter,
  useGroupImages,
  useUploadGroupImages,
  useRenameGroupImage,
  useMoveGroupImages,
  useDeleteGroupImages,
  type GroupImageRow,
} from "@/hooks/useCharacters";
import { SignedImage } from "@/components/SignedImage";
import { ImageLightbox, type LightboxItem } from "@/components/image-lightbox";
import { ImageDownloadMenu } from "@/components/image-download-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { queuePendingRefs } from "@/lib/pendingRefs";
import { MAX_REFS } from "@/lib/studioRefs";
import { cn } from "@/lib/utils";

const BUCKET = "character-refs";
const MAX_INJECT = 9;

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsPage,
  head: () => ({
    meta: [
      { title: "이미지 그룹 · ToonPilot" },
      {
        name: "description",
        content: "레퍼런스 이미지를 그룹으로 관리하고 만들기 스튜디오에 바로 불러옵니다.",
      },
      { property: "og:title", content: "이미지 그룹 · ToonPilot" },
      {
        property: "og:description",
        content: "레퍼런스 이미지를 그룹으로 관리하고 만들기 스튜디오에 바로 불러옵니다.",
      },
    ],
  }),
});

type SortKey = "recent" | "oldest" | "name";

function sortBy<T extends { created_at: string; name: string }>(rows: T[], key: SortKey) {
  const out = [...rows];
  if (key === "name") out.sort((a, b) => a.name.localeCompare(b.name));
  else
    out.sort((a, b) =>
      key === "recent"
        ? +new Date(b.created_at) - +new Date(a.created_at)
        : +new Date(a.created_at) - +new Date(b.created_at),
    );
  return out;
}

function Toolbar({
  q,
  setQ,
  sort,
  setSort,
  cols,
  setCols,
  placeholder,
}: {
  q: string;
  setQ: (v: string) => void;
  sort: SortKey;
  setSort: (v: SortKey) => void;
  cols: number;
  setCols: (v: number) => void;
  placeholder: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="h-10 rounded-full bg-muted/50 pl-9"
        />
      </div>
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as SortKey)}
        className="h-10 rounded-full border border-border bg-card px-4 text-sm font-semibold"
      >
        <option value="recent">{t("groups.sort_recent", "최근순")}</option>
        <option value="oldest">{t("groups.sort_oldest", "오래된순")}</option>
        <option value="name">{t("groups.sort_name", "이름순")}</option>
      </select>
      <div className="flex w-40 items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {t("groups.zoom", "크기")}
        </span>
        <Slider
          value={[8 - cols]}
          min={2}
          max={6}
          step={1}
          onValueChange={([v]) => setCols(8 - (v ?? 4))}
        />
      </div>
    </div>
  );
}

const gridCols: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6",
};

function GroupsPage() {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  return openGroupId ? (
    <GroupDetail groupId={openGroupId} onBack={() => setOpenGroupId(null)} />
  ) : (
    <GroupList onOpen={setOpenGroupId} />
  );
}

/* ------------------------------- 목록 뷰 ------------------------------- */

function GroupList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const { tenantId } = useTenant();
  const { data: groups = [], isLoading } = useCharacters();
  const create = useCreateCharacter();
  const del = useDeleteCharacter();

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [cols, setCols] = useState(4);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const list = useMemo(() => {
    const rows = groups
      .filter((g) => g.display_name.toLowerCase().includes(q.trim().toLowerCase()))
      .map((g) => ({ ...g, name: g.display_name }));
    return sortBy(rows, sort);
  }, [groups, q, sort]);

  async function handleCreate() {
    if (!tenantId) return toast.error(t("characters.tenant_missing"));
    const name = newName.trim();
    if (!name) return toast.error(t("groups.name_required", "그룹명을 입력해 주세요."));
    try {
      const id = await create.mutateAsync({ tenantId, displayName: name });
      setNewName("");
      setCreating(false);
      toast.success(t("groups.created", "그룹을 만들었습니다."));
      onOpen(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-primary">
            {t("groups.eyebrow", "이미지 그룹")}
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
            {t("groups.title", "이미지 그룹")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("groups.sub", "레퍼런스 이미지를 그룹으로 모아두고 스튜디오에서 바로 사용하세요.")}
          </p>
        </div>
        <Button className="h-11 rounded-full px-5 font-bold" onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("groups.new_group", "새 그룹 만들기")}
        </Button>
      </header>

      {creating && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-3xl bg-card p-4 shadow-toss">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder={t("groups.name_placeholder", "예: 주인공 A 레퍼런스")}
            className="h-11 min-w-[220px] flex-1 rounded-xl bg-muted/50 px-4"
          />
          <Button className="h-11 rounded-xl px-6 font-bold" disabled={create.isPending} onClick={handleCreate}>
            {create.isPending ? t("common.uploading") : t("common.add")}
          </Button>
        </div>
      )}

      <div className="mt-6">
        <Toolbar
          q={q}
          setQ={setQ}
          sort={sort}
          setSort={setSort}
          cols={cols}
          setCols={setCols}
          placeholder={t("groups.search_groups", "그룹명 검색")}
        />
      </div>

      <section className="mt-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Users className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold">{t("groups.empty_title", "그룹이 없어요.")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("groups.empty_hint", "새 그룹을 만들고 레퍼런스 이미지를 등록해 보세요.")}
            </p>
          </div>
        ) : (
          <div className={cn("grid gap-4", gridCols[cols])}>
            {list.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onOpen(g.id)}
                className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-toss-sm transition hover:shadow-toss"
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  <SignedImage
                    bucket={BUCKET}
                    path={g.primary_path}
                    alt={g.display_name}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                </div>
                <div className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{g.display_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("groups.image_count", { defaultValue: "{{n}}장", n: g.image_count })}
                      {g.is_default && ` · ${t("groups.protected", "기본 그룹")}`}
                    </div>
                  </div>
                  {!g.is_default && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={t("common.delete")}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-destructive opacity-0 transition hover:bg-destructive/10 group-hover:opacity-100"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(t("characters.confirm_delete", { name: g.display_name }))) return;
                        try {
                          await del.mutateAsync(g.id);
                          toast.success(t("characters.deleted_toast"));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : String(err));
                        }
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/* ------------------------------- 상세 뷰 ------------------------------- */

function GroupDetail({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { data: groups = [] } = useCharacters();
  const group = groups.find((g) => g.id === groupId);
  const { data: images = [], isLoading } = useGroupImages(groupId);

  const upload = useUploadGroupImages();
  const renameGroup = useRenameCharacter();
  const renameImage = useRenameGroupImage();
  const moveImages = useMoveGroupImages();
  const deleteImages = useDeleteGroupImages();

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [cols, setCols] = useState(4);
  const [selected, setSelected] = useState<string[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const list = useMemo(() => {
    const rows = images
      .map((i) => ({ ...i, name: i.display_name ?? i.storage_path.split("/").pop() ?? "" }))
      .filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()));
    return sortBy(rows, sort);
  }, [images, q, sort]);

  const lightboxItems: LightboxItem[] = list.map((i) => ({
    id: i.id,
    bucket: BUCKET,
    path: i.storage_path,
    alt: i.name,
    info: [
      { label: t("groups.info_name", "이름"), value: i.name },
      {
        label: t("groups.info_created", "등록일"),
        value: new Date(i.created_at).toLocaleString(),
      },
      { label: t("groups.info_author", "등록자"), value: i.created_by ?? "-" },
      {
        label: t("groups.info_format", "형식"),
        value: (i.storage_path.split(".").pop() ?? "").toUpperCase(),
      },
      { label: t("groups.info_group", "그룹"), value: group?.display_name ?? "-" },
    ],
  }));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function useAsReference(rows: GroupImageRow[]) {
    if (rows.length === 0) return;
    if (rows.length > MAX_INJECT) {
      toast.error(
        t("groups.max_inject", {
          defaultValue: "레퍼런스로는 한 번에 최대 {{n}}개까지 보낼 수 있습니다.",
          n: MAX_INJECT,
        }),
      );
      return;
    }
    queuePendingRefs(
      rows.slice(0, Math.min(MAX_INJECT, MAX_REFS)).map((r) => ({
        path: r.storage_path,
        name: r.display_name ?? undefined,
        roles: r.roles?.length ? r.roles : ["character"],
      })),
    );
    navigate({ to: "/generate" });
  }

  async function handleUpload(files: File[]) {
    if (!tenantId || files.length === 0) return;
    try {
      const n = await upload.mutateAsync({ tenantId, groupId, files });
      toast.success(t("groups.uploaded", { defaultValue: "{{n}}장을 등록했습니다.", n }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleMove(ids: string[]) {
    const others = groups.filter((g) => g.id !== groupId);
    if (others.length === 0) return toast.error(t("groups.no_target", "이동할 다른 그룹이 없어요."));
    const target = prompt(
      t("groups.move_prompt", "이동할 그룹명을 입력하세요:") +
        "\n" +
        others.map((g) => `- ${g.display_name}`).join("\n"),
    );
    if (!target) return;
    const dest = others.find((g) => g.display_name === target.trim());
    if (!dest) return toast.error(t("groups.no_match", "일치하는 그룹이 없어요."));
    try {
      await moveImages.mutateAsync({ ids, toGroupId: dest.id });
      setSelected([]);
      toast.success(t("groups.moved", "그룹을 이동했습니다."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(ids: string[]) {
    if (!confirm(t("groups.confirm_delete_images", { defaultValue: "{{n}}장을 삭제할까요?", n: ids.length })))
      return;
    try {
      await deleteImages.mutateAsync({ ids, groupId });
      setSelected((prev) => prev.filter((id) => !ids.includes(id)));
      setLightboxIdx(null);
      toast.success(t("groups.deleted_images", "삭제했습니다."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRenameImage(row: GroupImageRow) {
    const next = prompt(t("groups.rename_image", "이미지 이름"), row.display_name ?? "");
    if (next == null) return;
    await renameImage.mutateAsync({ id: row.id, groupId, displayName: next.trim() });
  }

  async function handleRenameGroup() {
    const next = prompt(t("groups.rename_group", "그룹명"), group?.display_name ?? "");
    if (next == null || !next.trim()) return;
    await renameGroup.mutateAsync({ id: groupId, displayName: next.trim() });
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 pb-28 sm:py-10">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" className="h-10 rounded-full px-3 font-semibold" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t("groups.back", "목록")}
        </Button>
        <h1 className="text-2xl font-extrabold tracking-tight">{group?.display_name ?? ""}</h1>
        <Button variant="outline" size="sm" className="h-9 rounded-full" onClick={handleRenameGroup}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          {t("groups.edit_name", "그룹명 수정")}
        </Button>
        <div className="ml-auto">
          <Button
            className="h-10 rounded-full px-5 font-bold"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="mr-1.5 h-4 w-4" />
            {upload.isPending ? t("common.uploading") : t("groups.add_images", "이미지 등록")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleUpload(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="mt-6">
        <Toolbar
          q={q}
          setQ={setQ}
          sort={sort}
          setSort={setSort}
          cols={cols}
          setCols={setCols}
          placeholder={t("groups.search_images", "이미지명 검색")}
        />
      </div>

      <section className="mt-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : list.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {t("groups.empty_images", "등록된 이미지가 없어요.")}
          </div>
        ) : (
          <div className={cn("grid gap-4", gridCols[cols])}>
            {list.map((img, idx) => {
              const isSel = selected.includes(img.id);
              return (
                <div
                  key={img.id}
                  className={cn(
                    "group overflow-hidden rounded-2xl border bg-card shadow-toss-sm transition hover:shadow-toss",
                    isSel ? "border-primary ring-2 ring-primary/40" : "border-border",
                  )}
                >
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    <button
                      type="button"
                      className="h-full w-full"
                      onClick={() => setLightboxIdx(idx)}
                      aria-label={img.name}
                    >
                      <SignedImage
                        bucket={BUCKET}
                        path={img.storage_path}
                        alt={img.name}
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    </button>
                    <button
                      type="button"
                      aria-label={t("groups.select", "선택")}
                      onClick={() => toggle(img.id)}
                      className={cn(
                        "absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full border transition",
                        isSel
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background/80 text-transparent hover:text-muted-foreground",
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="truncate text-xs font-bold">{img.name}</div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 rounded-lg px-2 text-[11px] font-semibold"
                        onClick={() => useAsReference([img])}
                      >
                        <Wand2 className="mr-1 h-3 w-3" />
                        {t("groups.use_as_ref", "레퍼런스로 사용")}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-lg"
                        aria-label={t("groups.rename_image", "이미지 이름")}
                        onClick={() => handleRenameImage(img)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-lg"
                        aria-label={t("groups.move", "그룹 이동")}
                        onClick={() => handleMove([img.id])}
                      >
                        <FolderInput className="h-3.5 w-3.5" />
                      </Button>
                      <ImageDownloadMenu
                        bucket={BUCKET}
                        path={img.storage_path}
                        baseName={img.name}
                        variant="ghost"
                        size="icon"
                        compact
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                        aria-label={t("common.delete")}
                        onClick={() => handleDelete([img.id])}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-5 py-3">
            <span className="text-sm font-bold">
              {t("groups.selected_count", { defaultValue: "{{n}}개 선택", n: selected.length })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full"
              onClick={() => setSelected(list.map((i) => i.id))}
            >
              {t("groups.select_all", "전체 선택")}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 rounded-full" onClick={() => setSelected([])}>
              {t("groups.clear_selection", "선택 해제")}
            </Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="h-9 rounded-full font-bold"
                onClick={() => useAsReference(list.filter((i) => selected.includes(i.id)))}
              >
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                {t("groups.use_as_ref", "레퍼런스로 사용")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-full"
                onClick={() => handleMove(selected)}
              >
                <FolderInput className="mr-1.5 h-3.5 w-3.5" />
                {t("groups.move", "그룹 이동")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-full text-destructive"
                onClick={() => handleDelete(selected)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {lightboxIdx !== null && lightboxItems[lightboxIdx] && (
        <ImageLightbox
          items={lightboxItems}
          index={lightboxIdx}
          onIndexChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
          renderActions={(item) => {
            const row = list.find((i) => i.id === item.id);
            if (!row) return null;
            return (
              <>
                <Button size="sm" className="h-9 rounded-full font-bold" onClick={() => useAsReference([row])}>
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("groups.use_as_ref", "레퍼런스로 사용")}
                </Button>
                <ImageDownloadMenu bucket={BUCKET} path={row.storage_path} baseName={row.name} variant="outline" />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full text-destructive"
                  onClick={() => handleDelete([row.id])}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("common.delete")}
                </Button>
              </>
            );
          }}
        />
      )}
    </main>
  );
}
