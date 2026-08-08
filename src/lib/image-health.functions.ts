import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkImageModelHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { probeSeedream } = await import("@/lib/image-health.server");
    const models = [await probeSeedream()];

    return {
      checkedAt: new Date().toISOString(),
      canGenerate: models.some((m) => m.status === "available"),
      models,
    };
  });
