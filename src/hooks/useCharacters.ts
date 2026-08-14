import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RoleTag } from "@/lib/studioRefs";

export type CharacterRow = {
  id: string;
  display_name: string;
  created_at: string;
  primary_path: string | null;
  /** "기본 그룹" — 삭제/선택 불가(protected) */
  is_default: boolean;
  image_count: number;
};

/** 이미지 그룹에 속한 개별 이미지 */
export type GroupImageRow = {
  id: string;
  character_id: string;
  storage_path: string;
  display_name: string | null;
  roles: RoleTag[];
  is_primary: boolean;
  seq: number;
  created_at: string;
  created_by: string | null;
};

async function fetchCharacters(): Promise<CharacterRow[]> {
  const { data: chars, error } = await supabase
    .from("characters")
    .select(
      "id, display_name, created_at, is_default, character_images(storage_path, is_primary, seq)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (chars ?? []).map((c: any) => {
    const imgs = [...(c.character_images ?? [])];
    const primary =
      imgs.find((i: any) => i.is_primary)?.storage_path ??
      imgs.sort((a: any, b: any) => a.seq - b.seq)[0]?.storage_path ??
      null;
    return {
      id: c.id,
      display_name: c.display_name,
      created_at: c.created_at,
      primary_path: primary,
      is_default: !!c.is_default,
      image_count: imgs.length,
    };
  });
}

export function useCharacters() {
  return useQuery({ queryKey: ["characters"], queryFn: fetchCharacters });
}

/** 그룹 상세: 그룹에 등록된 이미지 목록 */
export function useGroupImages(groupId: string | null) {
  return useQuery({
    queryKey: ["group-images", groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<GroupImageRow[]> => {
      const { data, error } = await supabase
        .from("character_images")
        .select(
          "id, character_id, storage_path, display_name, roles, is_primary, seq, created_at, created_by",
        )
        .eq("character_id", groupId!)
        .order("seq", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, roles: (r.roles ?? []) as RoleTag[] }));
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (groupId?: string | null) => {
    qc.invalidateQueries({ queryKey: ["characters"] });
    qc.invalidateQueries({ queryKey: ["group-images", groupId ?? undefined] });
    if (!groupId) qc.invalidateQueries({ queryKey: ["group-images"] });
  };
}

export function useCreateCharacter() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { tenantId: string; displayName: string; file?: File | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const { data: c, error } = await supabase
        .from("characters")
        .insert({
          tenant_id: input.tenantId,
          display_name: input.displayName,
          created_by: uid,
        })
        .select("id")
        .single();
      if (error || !c) throw error ?? new Error("CHARACTER_INSERT_FAILED");

      if (input.file) {
        const ext = input.file.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${input.tenantId}/characters/${c.id}/primary-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("character-refs")
          .upload(path, input.file, { upsert: false, contentType: input.file.type });
        if (upErr) throw upErr;

        const { error: imgErr } = await supabase.from("character_images").insert({
          character_id: c.id,
          storage_path: path,
          display_name: input.file.name.replace(/\.[^.]+$/, ""),
          seq: 0,
          is_primary: true,
          created_by: uid,
        });
        if (imgErr) throw imgErr;
      }
      return c.id;
    },
    onSuccess: () => invalidate(),
  });
}

/** 그룹명 수정 */
export function useRenameCharacter() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; displayName: string }) => {
      const { error } = await supabase
        .from("characters")
        .update({ display_name: input.displayName })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCharacter() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (characterId: string) => {
      const { data: imgs } = await supabase
        .from("character_images")
        .select("storage_path")
        .eq("character_id", characterId);
      const paths = (imgs ?? []).map((i) => i.storage_path);
      if (paths.length) {
        await supabase.storage.from("character-refs").remove(paths);
      }
      const { error } = await supabase.from("characters").delete().eq("id", characterId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

/** 그룹에 이미지 등록 (character-refs 버킷 직접 업로드, storage path 만 저장) */
export function useUploadGroupImages() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { tenantId: string; groupId: string; files: File[] }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const { data: existing } = await supabase
        .from("character_images")
        .select("id, seq")
        .eq("character_id", input.groupId);
      let seq = (existing ?? []).reduce((m, r: any) => Math.max(m, r.seq ?? 0), -1) + 1;
      const isFirst = (existing ?? []).length === 0;
      const rows: any[] = [];
      for (const file of input.files) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${input.tenantId}/characters/${input.groupId}/img-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("character-refs")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        rows.push({
          character_id: input.groupId,
          storage_path: path,
          display_name: file.name.replace(/\.[^.]+$/, ""),
          seq: seq++,
          is_primary: isFirst && rows.length === 0,
          created_by: uid,
        });
      }
      if (rows.length === 0) return 0;
      const { error } = await supabase.from("character_images").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (_d, v) => invalidate(v.groupId),
  });
}

/** 이미지 이름 수정 */
export function useRenameGroupImage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; groupId: string; displayName: string }) => {
      const { error } = await supabase
        .from("character_images")
        .update({ display_name: input.displayName })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.groupId),
  });
}

/** 이미지 역할 태그 저장 */
export function useSetGroupImageRoles() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; groupId: string; roles: RoleTag[] }) => {
      const { error } = await supabase
        .from("character_images")
        .update({ roles: input.roles })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.groupId),
  });
}

/** 이미지 그룹 이동 (여러 장) */
export function useMoveGroupImages() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { ids: string[]; toGroupId: string }) => {
      if (input.ids.length === 0) return;
      const { error } = await supabase
        .from("character_images")
        .update({ character_id: input.toGroupId, is_primary: false })
        .in("id", input.ids);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

/** 이미지 삭제 (스토리지 + 레코드) */
export function useDeleteGroupImages() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { ids: string[]; groupId?: string | null }) => {
      if (input.ids.length === 0) return;
      const { data: rows } = await supabase
        .from("character_images")
        .select("storage_path")
        .in("id", input.ids);
      const paths = (rows ?? []).map((r) => r.storage_path).filter(Boolean);
      if (paths.length) await supabase.storage.from("character-refs").remove(paths);
      const { error } = await supabase.from("character_images").delete().in("id", input.ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.groupId ?? null),
  });
}
