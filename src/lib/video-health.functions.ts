import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkVideoModelHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { probeSeedance, probeReplicate } = await import(
      "@/lib/video-health.server"
    );

    const [seedance, replicate] = await Promise.all([
      probeSeedance(),
      probeReplicate(),
    ]);

    const models = [seedance, replicate];

    return {
      checkedAt: new Date().toISOString(),
      canGenerate: models.some((m) => m.status === "available"),
      models,
    };
  });

