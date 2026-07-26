// src/lib/loadConfig.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { PromptConfig } from './promptEngine';

export async function loadConfig(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<PromptConfig> {
  const { data, error } = await supabase
    .from('presets')
    .select('sheet,item_id,label_ko,label_en,prompt_text,level,sort_order')
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .eq('active', true)
    .order('sort_order');

  if (error) throw error;

  const cfg: PromptConfig = {};
  for (const r of data ?? []) {
    (cfg[r.sheet] ??= []).push({
      id: r.item_id,
      label_ko: r.label_ko,
      label_en: r.label_en ?? '',
      prompt_text: r.prompt_text ?? '',
      level: r.level ?? 0,
    });
  }
  return cfg;
}
