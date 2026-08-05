import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkVideoModelHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { probeSeedance } = await import("@/lib/video-health.server");
    const models = [await probeSeedance()];

    return {
      checkedAt: new Date().toISOString(),
      canGenerate: models.some((m) => m.status === "available"),
      models,
    };
  });

