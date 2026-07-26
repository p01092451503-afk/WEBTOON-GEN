import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { useCharacters, useCreateCharacter, useDeleteCharacter } from "@/hooks/useCharacters";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/characters")({
  component: CharactersPage,
  head: () => ({ meta: [{ title: "캐릭터 라이브러리 · toonpilot" }] }),
});

function CharactersPage() {
  const { tenantId } = useTenant();
  const { data: characters = [], isLoading } = useCharacters();
  const create = useCreateCharacter();
  const del = useDeleteCharacter();

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function onPickFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return toast.error("테넌트를 찾을 수 없습니다.");
    if (!name.trim() || !file) return toast.error("이름과 이미지를 입력하세요.");
    try {
      await create.mutateAsync({ tenantId, displayName: name.trim(), file });
      toast.success("캐릭터가 추가됐어요");
      setName("");
      onPickFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-primary">라이브러리</div>
          <h1 className="mt-1 truncate text-3xl font-extrabold tracking-tight">캐릭터</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            한 번 등록하면 모든 생성에서 바로 불러올 수 있어요.
          </p>
        </div>
        <Link
          to="/generate"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-primary-soft px-4 text-sm font-semibold text-primary hover:bg-primary-soft/70"
        >
          생성 화면으로 →
        </Link>
      </header>

      <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-toss-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold">
          <ImagePlus className="h-4 w-4 text-primary" />새 캐릭터 추가
        </div>
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]"
        >
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">이름</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 지수"
              className="h-11 rounded-xl bg-muted/50 px-4"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">대표 이미지</Label>
            <label className="flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-3 text-sm text-muted-foreground hover:bg-muted">
              {preview ? (
                <img src={preview} alt="" className="h-8 w-8 rounded-md object-cover" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              <span className="truncate">{file ? file.name : "이미지 선택"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <Button
            type="submit"
            disabled={create.isPending}
            className="h-11 rounded-xl px-6 font-bold"
          >
            {create.isPending ? "업로드 중…" : "추가"}
          </Button>
        </form>
      </section>

      <section className="mt-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        ) : characters.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Users className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold">아직 캐릭터가 없어요</p>
            <p className="mt-1 text-xs text-muted-foreground">
              위 폼에서 이름과 대표 이미지를 등록해보세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {characters.map((c) => (
              <div
                key={c.id}
                className="group overflow-hidden rounded-2xl border border-border bg-card shadow-toss-sm transition hover:shadow-toss"
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  <SignedImage
                    bucket="character-refs"
                    path={c.primary_path}
                    alt={c.display_name}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                </div>
                <div className="space-y-2 p-3">
                  <div className="truncate text-sm font-bold">{c.display_name}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={del.isPending}
                    onClick={async () => {
                      if (!confirm(`${c.display_name} 삭제할까요?`)) return;
                      try {
                        await del.mutateAsync(c.id);
                        toast.success("삭제됐어요");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : String(e));
                      }
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> 삭제
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
