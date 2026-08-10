const HANGUL = /[\u3131-\uD79D]/;
// Common Korean romanization endings — used to drop transliterated lines from EN output.
const ROMANIZED_HINT =
  /\b\w*(eul|reul|neun|eun|haneun|haeseo|hago|imnida|hamnida|seubnida|hae|ui|ege|eseo|gwa|wa)\b/gi;

/** Keep only the target-language text: drop commentary, romanization and stray numbers. */
export function cleanTranslation(text: string, target: "ko" | "en"): string {
  const stripped = text
    .replace(/^\s*```[a-zA-Z0-9_-]*\s*$/gm, "")
    .replace(/```/g, "")
    .trim();

  const kept = stripped.split("\n").filter((line) => {
    const s = line.trim();
    if (!s) return true;
    // stray counters like "55"
    if (/^[0-9\s.,:()-]+$/.test(s)) return false;
    // meta commentary
    if (/^(translation|번역|note|참고)\s*[::-]/i.test(s)) return false;

    if (target === "en") {
      // no source-language leftovers
      if (HANGUL.test(s)) return false;
      // romanized Korean line (many transliteration endings, few English words)
      const words = s.split(/\s+/).filter(Boolean);
      const hits = (s.match(ROMANIZED_HINT) ?? []).length;
      if (words.length >= 3 && hits / words.length >= 0.3) return false;
    } else if (!HANGUL.test(s) && /[a-zA-Z]/.test(s)) {
      // KO target: drop a pure-English duplicate of the source, keep short technical tokens
      const words = s.split(/\s+/).filter(Boolean);
      if (words.length >= 4) return false;
    }
    return true;
  });

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
