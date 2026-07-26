import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { useCharacters, useCreateCharacter, useDeleteCharacter } from "@/hooks/useCharacters";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return toast.error("테넌트를 찾을 수 없습니다.");
    if (!name.trim() || !file) return toast.error("이름과 이미지를 입력하세요.");
    try {
      await create.mutateAsync({ tenantId, displayName: name.trim(), file });
      toast.success("캐릭터 추가됨");
      setName("");
      setFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">캐릭터 라이브러리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            생성에 사용할 캐릭터 레퍼런스를 관리합니다.
          </p>
        </div>
        <Link to="/generate" className="text-sm underline">
          생성 화면으로 →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">새 캐릭터 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <Label className="text-xs">이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 지수" />
            </div>
            <div>
              <Label className="text-xs">대표 이미지</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "업로드 중…" : "추가"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : characters.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
          아직 캐릭터가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {characters.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <SignedImage
                bucket="character-refs"
                path={c.primary_path}
                alt={c.display_name}
                className="w-full aspect-square object-cover"
              />
              <CardContent className="p-3 space-y-2">
                <div className="font-medium text-sm truncate">{c.display_name}</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={del.isPending}
                  onClick={async () => {
                    if (!confirm(`${c.display_name} 삭제?`)) return;
                    try {
                      await del.mutateAsync(c.id);
                      toast.success("삭제됨");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  삭제
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
