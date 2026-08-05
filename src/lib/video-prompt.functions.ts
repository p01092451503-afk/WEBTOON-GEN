import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const composeVideoPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        subject: z.string().max(3000).default(""),
        action: z.string().max(3000).default(""),
        camera: z.string().max(2000).default(""),
        lighting: z.string().max(2000).default(""),
        style: z.string().max(3000).default(""),
        safetyMode: z.enum(["normal", "strict"]).optional(),
      })
      .refine((value) => Object.values(value).some((item) => typeof item === "string" && item.trim().length > 0), {
        message: "Add an action or select at least one shot control.",
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { composeVideoPromptText, buildSafetyAwareNegativePrompt } = await import("@/lib/video-prompt.server");
    const finalPrompt = await composeVideoPromptText(data);
    return {
      finalPrompt,
      negativePrompt: buildSafetyAwareNegativePrompt(),
    };
  });

