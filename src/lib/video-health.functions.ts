import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkVideoModelHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { probeLovableVideoModel, probeReplicate } = await import(
      "@/lib/video-health.server"
    );

    const [veo, replicate] = await Promise.all([
      probeLovableVideoModel("google/veo-3.1-fast", "Google Veo 3.1 Fast"),
      probeReplicate(),
    ]);

    const models = [veo, replicate];

    return {
      checkedAt: new Date().toISOString(),
      canGenerate: models.some((m) => m.status === "available"),
      models,
    };
  });

