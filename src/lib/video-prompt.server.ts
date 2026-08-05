import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export type VideoPromptControls = {
  subject: string;
  action: string;
  camera: string;
  lighting: string;
  style: string;
  safetyMode?: "normal" | "strict";
};

const BASE_SYSTEM_PROMPT =
  "You rewrite shot controls into ONE flowing cinematic paragraph for a text-to-video model. " +
  "Write 4 to 8 sentences in the present tense. Describe subject, action, camera movement, " +
  "lighting, mood, and visual style in natural prose. Use observable physical cues instead of " +
  "emotion labels. Follow this order: Subject, Action, Camera, Lighting, Style. Preserve all " +
  "concrete details supplied by the user without inventing new characters or events. If the " +
  "Action control contains Korean, translate its meaning directly into natural cinematic English " +
  "while preserving names, actions, timing, direction, and spatial relationships. Uploaded reference " +
  "media is supplied separately to the video model, so do not add media tokens or mention syntax. " +
  "If the user refers to uploaded references with labels like img1, img2, video1, etc., keep their " +
  "intent in the paragraph and describe how each reference should influence the scene. " +
  "Do not use image-prompt conventions or introduce Figure 1/Figure 2 labels. Output English only, " +
  "with no Korean text, lists, headings, quotes, negative instructions, or commentary.";


const SAFETY_APPENDIX =
  " This is a safety-aware rewrite. Avoid names, addresses, phone numbers, IDs, screens, account " +
  "details, or any other visible personal/confidential information. Avoid copyrighted characters, " +
  "franchise names, trademarks, logos, or distinct celebrity likenesses. Avoid explicit sexual acts, " +
  "graphic violence, hateful symbols, or non-consensual scenarios. Keep the subject description " +
  "neutral and cinematic; prefer full-body, medium, or wide framing over extreme close-ups of " +
  "sensitive body areas. If the user's wording might trigger an automated safety filter, rephrase " +
  "it with the same visual intent using generic, physical, non-identifying language.";

const STRICT_SAFETY_APPENDIX =
  " This is a strict safety rewrite. Err strongly on the side of caution. Remove or replace any " +
  "wording that could be interpreted as personal information, copyright infringement, sexual " +
  "solicitation, or graphic content. Replace named people, characters, or brands with generic " +
  "descriptions. Keep camera framing at medium or wide shots. Avoid romantic or intimate physical " +
  "contact beyond holding hands or walking side by side. Output only the rewritten paragraph, " +
  "nothing else.";

const containsKorean = (value: string) => /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(value);

const unsafeTokenPattern =
  /(@[\w_-]+|#\w+|\bfigure\s+\d+|\bpeppa\s*pig|\bmickey\s*mouse|\bdisney|\bmarvel|\bstar\s*wars|\bspider[-\s]?man|\bbatman|\bsuperman|\bhello\s*kitty|\bpokemon|\bspongebob|\bcopyright|\btrademark|\blogo\b|\bwatermark\b|\bphone\s*number|\baddress\b|\bemail\b|\bpassword\b|\bssn\b|\bid\s*card|\bpassport\b|\bnsfw\b|\bnude\b|\bnaked\b|\bsex\b|\bsexual\b|\berotic\b|\bporn\b|\bviolence\b|\bgore\b|\bblood\b|\btorture\b|\bkill\b|\bmurder\b|\bhate\b|\bracist\b|\bterrorist\b|\bdrug\b)/giu;

export function sanitizeVideoPromptText(raw: string) {
  return raw
    .replace(unsafeTokenPattern, (match) => {
      const lower = match.toLowerCase().trim();
      if (lower.startsWith("@")) return "";
      if (lower.includes("figure")) return "";
      if (lower.includes("phone") || lower.includes("address") || lower.includes("email") || lower.includes("password") || lower.includes("ssn") || lower.includes("id card") || lower.includes("passport")) return "";
      if (lower.includes("copyright") || lower.includes("trademark") || lower.includes("logo") || lower.includes("watermark")) return "";
      if (lower.includes("nude") || lower.includes("naked") || lower.includes("sex") || lower.includes("erotic") || lower.includes("porn")) return "";
      if (lower.includes("violence") || lower.includes("gore") || lower.includes("blood") || lower.includes("torture") || lower.includes("kill") || lower.includes("murder")) return "a dramatic action";
      if (lower.includes("hate") || lower.includes("racist") || lower.includes("terrorist") || lower.includes("drug")) return "a tense scene";
      return "";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function composeVideoPromptText(controls: VideoPromptControls) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("PROMPT_COMPOSER_UNAVAILABLE");

  const safetyAppendix =
    controls.safetyMode === "strict"
      ? STRICT_SAFETY_APPENDIX
      : controls.safetyMode === "normal"
        ? SAFETY_APPENDIX
        : "";

  const gateway = createLovableAiGatewayProvider(apiKey);
  const actionTranslationInstruction = containsKorean(controls.action)
    ? "The Action field contains Korean. Translate it into English as part of this single rewrite; do not call or imitate the image translation prompt."
    : "Keep the Action field in natural English.";

  const safeAction = sanitizeVideoPromptText(controls.action);
  const safeSubject = sanitizeVideoPromptText(controls.subject);
  const safeCamera = sanitizeVideoPromptText(controls.camera);
  const safeLighting = sanitizeVideoPromptText(controls.lighting);
  const safeStyle = sanitizeVideoPromptText(controls.style);

  const controlText = [
    `Subject: ${safeSubject || "Not specified"}`,
    `Action: ${safeAction || "Not specified"}`,
    `Camera: ${safeCamera || "Not specified"}`,
    `Lighting: ${safeLighting || "Not specified"}`,
    `Style: ${safeStyle || "Not specified"}`,
  ].join("\n");

  const result = await generateText({
    model: gateway("google/gemini-3.6-flash"),
    system: BASE_SYSTEM_PROMPT + safetyAppendix,
    prompt: `${actionTranslationInstruction}\nRewrite these shot controls as the requested cinematic paragraph:\n\n${controlText}`,
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

export function buildSafetyAwareNegativePrompt(userNegative?: string) {
  const base =
    "low quality, worst quality, deformed, distorted, blurry, watermark, text, signature, " +
    "username, address, phone number, id card, passport, screen, ui, interface, subtitle, " +
    "static, jittery motion, duplicate frames, malformed hands, extra limbs";
  const extra = userNegative?.trim();
  return extra ? `${base}, ${extra}` : base;
}

