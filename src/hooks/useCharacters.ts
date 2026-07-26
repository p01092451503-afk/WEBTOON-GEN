import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CharacterRow = {
  id: string;
  display_name: string;
  created_at: string;
  primary_path: string | null;
};

async function fetchCharacters(): Promise<CharacterRow[]> {
  const { data: chars, error } = await supabase
    .from("characters")
    .select("id, display_name, created_at, character_images(storage_path, is_primary, seq)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (chars ?? []).map((c: any) => {
    const imgs = c.character_images ?? [];
    const primary =
      imgs.find((i: any) => i.is_primary)?.storage_path ??
      imgs.sort((a: any, b: any) => a.seq - b.seq)[0]?.storage_path ??
      null;
    return {
      id: c.id,
      display_name: c.display_name,
      created_at: c.created_at,
      primary_path: primary,
    };
  });
}

export function useCharacters() {
  return useQuery({ queryKey: ["characters"], queryFn: fetchCharacters });
}

export function useCreateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tenantId: string; displayName: string; file: File }) => {
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

      const ext = input.file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${input.tenantId}/characters/${c.id}/primary-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("character-refs")
        .upload(path, input.file, { upsert: false, contentType: input.file.type });
      if (upErr) throw upErr;

      const { error: imgErr } = await supabase.from("character_images").insert({
        character_id: c.id,
        storage_path: path,
        seq: 0,
        is_primary: true,
      });
      if (imgErr) throw imgErr;
      return c.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["characters"] }),
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["characters"] }),
  });
}
