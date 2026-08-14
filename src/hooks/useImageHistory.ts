import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ImageHistoryRow = {
  id: string;
  status: string;
  mode: string;
  work_label: string;
  aspect_ratio: string | null;
  api_model: string | null;
  seed: number | null;
  final_prompt: string | null;
  raw_prompt: string | null;
  prompt_edited: boolean;
  compiled_prompt: string | null;
  options: any;
  figure_map: any;
  warnings: any;
  batch_count: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  results: { id: string; seq: number; storage_path: string | null; thumb_path: string | null }[];
};

const SELECT =
  "id, status, mode, work_label, aspect_ratio, api_model, seed, final_prompt, raw_prompt, prompt_edited, compiled_prompt, options, figure_map, warnings, batch_count, error_message, created_at, completed_at, generation_results(id, seq, storage_path, thumb_path)";

/** Shared image-generation history query (generations + generation_results). */
export function useImageHistory(tenantId: string | null, limit = 100) {
  const [rows, setRows] = useState<ImageHistoryRow[] | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("generations")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      toast.error(error.message);
      setRows([]);
      return;
    }
    setRows(
      (data ?? []).map((r: any) => ({
        ...r,
        results: (r.generation_results ?? []).sort((a: any, b: any) => a.seq - b.seq),
      })),
    );
  }, [limit]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, load]);

  return { rows, setRows, reload: load };
}
