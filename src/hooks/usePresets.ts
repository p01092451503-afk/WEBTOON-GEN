import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadConfig } from "@/lib/loadConfig";

export function usePresets(tenantId: string | null) {
  return useQuery({
    queryKey: ["presets", tenantId],
    enabled: !!tenantId,
    queryFn: () => loadConfig(supabase as any, tenantId as string),
  });
}
