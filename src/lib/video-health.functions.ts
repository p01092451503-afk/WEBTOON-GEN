import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkVideoModelHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { probeLovableVideoModel, probeSeedance, probeReplicate } = await import(
      "@/lib/video-health.server"
    );

    const [fast, standard, seedance, replicate] = await Promise.all([
      probeLovableVideoModel("google/veo-3.1-fast", "Google Veo 3.1 Fast\u00a0"),
      probeLovableVideoModel("google/veo-3.1", "Google Veo 3.1\u00a0"),
      probeSeedance(),
      probeReplicate(),
    ]);

    const models = [fast, standard, seedance, replicate];


    return {
      checkedAt: new Date().toISOString(),
      canGenerate: models.some((m) => m.status === "available"),
      models,
    };
  });

