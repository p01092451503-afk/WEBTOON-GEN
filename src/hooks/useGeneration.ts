import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generate } from "@/lib/generate.functions";

export type GenerationResult = {
  id: string;
  seq: number;
  storage_path: string | null;
  thumb_path: string | null;
  seed: number | null;
};

export type GenerationRow = {
  id: string;
  status: string;
  error_message: string | null;
  final_prompt: string | null;
  panel_id: string | null;
  results: GenerationResult[];
};

export function useGeneration(tenantId: string | null) {
  const generateFn = useServerFn(generate);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [row, setRow] = useState<GenerationRow | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // realtime subscribe to running generation
  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("generations")
        .select(
          "id, status, error_message, final_prompt, panel_id, generation_results(id, seq, storage_path, thumb_path, seed)",
        )
        .eq("id", currentId)
        .maybeSingle();
      if (cancelled || !data) return;
      setRow({
        id: data.id,
        status: data.status,
        error_message: data.error_message,
        final_prompt: data.final_prompt,
        panel_id: (data as { panel_id: string | null }).panel_id ?? null,
        results: (data.generation_results ?? []).sort((a: any, b: any) => a.seq - b.seq),
      });
    };
    load();

    const channel = supabase
      .channel(`gen-${currentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "generations", filter: `id=eq.${currentId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_results",
          filter: `generation_id=eq.${currentId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentId]);

  async function run(input: Parameters<typeof generate>[0] extends undefined ? any : any) {
    if (!tenantId) throw new Error("NO_TENANT");
    setRunning(true);
    setError(null);
    setRow(null);
    setCurrentId(null);
    try {
      const res = await generateFn({ data: input });
      setCurrentId(res.generationId);
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setRunning(false);
    }
  }

  return { run, running, row, currentId, error };
}
