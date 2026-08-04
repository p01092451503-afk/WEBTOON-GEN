import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export type VideoPromptControls = {
  subject: string;
  action: string;
  camera: string;
  lighting: string;
  style: string;
};

const SYSTEM_PROMPT =
  "You rewrite shot controls into ONE flowing cinematic paragraph for a text-to-video model. " +
  "Write 4 to 8 sentences in the present tense. Describe subject, action, camera movement, " +
  "lighting, mood, and visual style in natural prose. Use observable physical cues instead of " +
  "emotion labels. Follow this order: Subject, Action, Camera, Lighting, Style. Preserve all " +
  "concrete details supplied by the user without inventing new characters or events. Output " +
  "English only, with no lists, headings, quotes, negative instructions, or commentary.";

export async function composeVideoPromptText(controls: VideoPromptControls) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("PROMPT_COMPOSER_UNAVAILABLE");

  const gateway = createLovableAiGatewayProvider(apiKey);
  const controlText = [
    `Subject: ${controls.subject || "Not specified"}`,
    `Action: ${controls.action || "Not specified"}`,
    `Camera: ${controls.camera || "Not specified"}`,
    `Lighting: ${controls.lighting || "Not specified"}`,
    `Style: ${controls.style || "Not specified"}`,
  ].join("\n");

  const result = await generateText({
    model: gateway("google/gemini-3.6-flash"),
    system: SYSTEM_PROMPT,
    prompt: `Rewrite these shot controls as the requested cinematic paragraph:\n\n${controlText}`,
  });

  const paragraph = result.text
    .trim()
    .replace(/^```(?:text)?\s*|```$/g, "")
    .replace(/^(["'])|(["'])$/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!paragraph) throw new Error("PROMPT_COMPOSER_EMPTY_RESPONSE");
  return paragraph;
}