import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export type ModerationDecision = { status: "approved" | "blocked"; categories: string[]; reason: string };

function parseDecision(text: string): ModerationDecision {
  try {
    const parsed = JSON.parse(text.replace(/^```json\s*|```$/g, "").trim()) as { status?: string; categories?: unknown; reason?: unknown };
    return {
      status: parsed.status === "blocked" ? "blocked" : "approved",
      categories: Array.isArray(parsed.categories) ? parsed.categories.filter((value): value is string => typeof value === "string").slice(0, 8) : [],
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 300) : "",
    };
  } catch {
    throw new Error("CONTENT_CHECK_INVALID_RESPONSE");
  }
}

export async function moderateVideoPrompt(prompt: string): Promise<ModerationDecision> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("CONTENT_CHECK_UNAVAILABLE");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const result = await generateText({
    model: gateway("google/gemini-3.6-flash"),
    prompt: "Classify this requested video before generation. Block only sexual content involving minors or age ambiguity, non-consensual sexual content, explicit sexual acts, graphic violence, hateful abuse, or instructions for serious wrongdoing. Do not block ordinary romance, swimwear, artistic nudity involving clearly adult subjects, or benign fiction. Return JSON only: {\"status\":\"approved|blocked\",\"categories\":[\"...\"],\"reason\":\"short user-safe reason\"}.\n\nREQUEST:\n" + prompt.slice(0, 5000),
  });
  return parseDecision(result.text);
}