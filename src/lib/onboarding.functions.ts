import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// 사용자의 프로필/테넌트가 없으면 최초 로그인 시 생성한다.
// profiles/tenants 는 client-facing INSERT 정책이 없으므로 admin 으로 실행.
export const bootstrapTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, tenant_id, role, display_name")
      .eq("id", userId)
      .maybeSingle();

    if (existing?.tenant_id) {
      return { tenantId: existing.tenant_id, created: false };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // RLS 우회하여 다시 한 번 확인 (SSR/세션 지연으로 첫 select 가 null 이 되는 경우 대비)
    const { data: adminExisting } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (adminExisting?.tenant_id) {
      return { tenantId: adminExisting.tenant_id, created: false };
    }

    const email = (claims as { email?: string })?.email ?? "";
    const displayName = email ? email.split("@")[0] : "New user";
    const tenantName = `${displayName}'s workspace`;

    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .insert({ name: tenantName, plan: "free" })
      .select("id")
      .single();
    if (tErr || !tenant) {
      throw new Error(`TENANT_CREATE_FAILED: ${tErr?.message ?? "unknown"}`);
    }

    const { error: pErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        tenant_id: tenant.id,
        role: "owner",
        display_name: displayName,
      },
      { onConflict: "id" },
    );
    if (pErr) {
      throw new Error(`PROFILE_CREATE_FAILED: ${pErr.message}`);
    }


    return { tenantId: tenant.id, created: true };
  });
