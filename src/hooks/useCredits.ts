import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { CREDITS_FEATURE_ENABLED } from "@/lib/credits";

/**
 * 테넌트 크레딧 잔액 조회 (읽기 전용).
 * 잔액 변경은 서버함수에서만 이루어진다 — 클라이언트는 표시만 한다.
 */
export function useCredits() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["credits", tenantId],
    enabled: !!tenantId && CREDITS_FEATURE_ENABLED,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("credit_balance, credits_enabled")
        .eq("id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return {
        balance: (data?.credit_balance as number | undefined) ?? 0,
        enabled: (data?.credits_enabled as boolean | undefined) ?? false,
      };
    },
  });

  const enabled = CREDITS_FEATURE_ENABLED && (q.data?.enabled ?? false);

  return {
    tenantId,
    /** 기능 플래그가 최종적으로 켜져 있는지 (env AND tenants.credits_enabled) */
    enabled,
    balance: q.data?.balance ?? null,
    loading: q.isLoading,
    refresh: () => qc.invalidateQueries({ queryKey: ["credits", tenantId] }),
  };
}
