import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  text: z.string().min(1).max(8000),
  target: z.enum(["ko", "en"]),
});

export const translatePrompt = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const sys =
      data.target === "ko"
        ? "You are a professional translator. Translate the user's image-generation prompt into natural Korean. Keep technical tokens like 'Figure 1', 'Figure 2', aspect ratios, camera terms, and style names intact. Preserve line breaks and structure. Output ONLY the Korean translation: no commentary, no notes, no romanization, no transliteration, no original text, no extra numbers or line counts."
        : "You are a professional translator. Translate the user's image-generation prompt into natural, concise English suitable for an AI image model. Keep technical tokens like 'Figure 1', 'Figure 2', aspect ratios, and style names intact. Preserve line breaks and structure. Output ONLY the English translation: no commentary, no notes, no romanization or transliteration of the source text, no original text, no word/character counts or stray numbers.";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: data.text },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit exceeded. Please retry shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please top up in workspace settings.");
      throw new Error(`Translation failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const translated = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!translated) throw new Error("Empty translation response");
    return { translated };
  });
