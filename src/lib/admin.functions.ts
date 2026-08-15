import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Verifies the caller is an admin using their own (RLS-scoped) profile row. */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("role")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin") throw new Error("FORBIDDEN");
}

export const listTenantsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tenants")
      .select("id, name, plan, credit_balance, credits_enabled, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((t) => t.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .in("tenant_id", ids);
      for (const p of profs ?? []) {
        counts[p.tenant_id] = (counts[p.tenant_id] ?? 0) + 1;
      }
    }
    return (data ?? []).map((t) => ({ ...t, member_count: counts[t.id] ?? 0 }));
  });

export const updateTenantCreditsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        tenantId: z.string().uuid(),
        creditBalance: z.number().int().min(0).max(100_000_000).optional(),
        creditsEnabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const patch: Record<string, unknown> = {};
    if (data.creditBalance !== undefined) patch.credit_balance = data.creditBalance;
    if (data.creditsEnabled !== undefined) patch.credits_enabled = data.creditsEnabled;
    if (Object.keys(patch).length === 0) throw new Error("NO_CHANGES");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tenants")
      .update(patch)
      .eq("id", data.tenantId)
      .select("id, name, plan, credit_balance, credits_enabled, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
