import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  /** character-refs bucket storage paths (still images, incl. frames sampled from a reference video) */
  imagePaths: z.array(z.string()).min(1).max(8),
  /** what the user wants to make, so the brief stays on target */
  intent: z.string().max(2000).optional(),
  /** true when some of the frames came from an uploaded reference video */
  hasVideoFrames: z.boolean().default(false),
});

export type ReferenceBrief = {
  subject: string;
  style: string;
  lighting: string;
  camera: string;
  motion: string;
  negative: string;
  promptSuffix: string;
};

const FALLBACK_MODELS = ["google/gemini-3.6-flash"];

export const analyzeReferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }): Promise<ReferenceBrief> => {
    const { supabase } = context;

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("REFERENCE_AI_UNAVAILABLE: LOVABLE_API_KEY is not configured.");

    const urls: string[] = [];
    for (const p of data.imagePaths) {
      const { data: signed, error } = await supabase.storage
        .from("character-refs")
        .createSignedUrl(p, 600);
      if (error || !signed?.signedUrl) throw new Error(`SIGNED_URL_FAILED: ${p}`);
      urls.push(signed.signedUrl);
    }

    const system =
      "You are a cinematography director. You study reference material and write precise, " +
      "literal English video-generation prompts. Never invent details that are not visible. " +
      "Keep every field short and concrete.";

    const instruction =
      (data.hasVideoFrames
        ? "The images are ordered frames sampled from a reference video, so infer the motion and camera movement from the differences between them. "
        : "The images are still references. ") +
      (data.intent?.trim()
        ? `The user wants to create: "${data.intent.trim()}". Describe the references so that this shot matches their look. `
        : "") +
      "Return JSON only with keys: subject, style, lighting, camera, motion, negative, promptSuffix. " +
      "promptSuffix must be a single comma-separated English clause list (max 60 words) that can be appended " +
      "to a video prompt to reproduce this look and motion. negative lists artifacts to avoid.";

    const body = {
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            ...urls.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        },
      ],
      response_format: { type: "json_object" as const },
    };

    let lastError = "";
    for (const model of FALLBACK_MODELS) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ model, ...body }),
      });

      if (res.status === 429) throw new Error("REFERENCE_RATE_LIMIT: Too many requests, try again shortly.");
      if (res.status === 402) throw new Error("REFERENCE_NO_CREDITS: AI credits exhausted for this workspace.");
      if (!res.ok) {
        lastError = `${res.status}: ${(await res.text()).slice(0, 300)}`;
        continue;
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      try {
        const parsed = JSON.parse(content.replace(/^```json\s*|```$/g, "").trim()) as Partial<ReferenceBrief>;
        return {
          subject: parsed.subject ?? "",
          style: parsed.style ?? "",
          lighting: parsed.lighting ?? "",
          camera: parsed.camera ?? "",
          motion: parsed.motion ?? "",
          negative: parsed.negative ?? "",
          promptSuffix: parsed.promptSuffix ?? "",
        };
      } catch {
        lastError = "Model returned non-JSON output.";
      }
    }

    throw new Error(`REFERENCE_ANALYSIS_FAILED: ${lastError}`);
  });
