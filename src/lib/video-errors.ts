// Converts provider failures into actionable, user-readable guidance.
export type VideoErrorInfo = {
  title: string;
  hint: string;
  category: "input" | "authentication" | "model" | "billing" | "rate_limit" | "provider" | "storage" | "safety" | "copyright" | "unknown";
  checks: string[];
  raw: string;
};

type ErrorGuide = Omit<VideoErrorInfo, "raw">;

function guide(category: ErrorGuide["category"], title: string, hint: string, checks: string[] = []): ErrorGuide {
  return { category, title, hint, checks };
}

function pick(raw: string): ErrorGuide {
  const r = raw.toLowerCase();
  if (
    r.includes("copyright restriction") ||
    r.includes("copyrighted") ||
    r.includes("intellectual property") ||
    r.includes("third-party character")
  ) {
    return guide(
      "copyright",
      "The reference or prompt is restricted by copyright protection.",
      "Seedance recognized a protected character or visual property. This cannot be fixed by retrying the same request.",
      [
        "Remove the protected character name from the prompt.",
        "Replace the reference image with an original character or material you own or are authorized to use.",
        "Describe only general visual traits instead of asking to reproduce a named character or franchise.",
      ],
    );
  }
  if (r.includes("content_blocked")) return guide("safety", "This request cannot be generated.", "Revise the content and try again.", ["Positive prompt: remove explicit, exploitative, hateful, or graphically violent descriptions.", "Reference media: replace any image or video that may trigger the safety policy."]);
  if (r.includes("content_check")) return guide("provider", "The safety check is temporarily unavailable.", "Your request was not sent to the provider. Try again shortly.");
  if (r.includes("unresolved_media_mention")) return guide("input", "A media mention could not be resolved.", "Choose the reference again from the @ menu.", ["@mention: confirm the referenced asset still exists and is selected from the menu."]);
  if (r.includes("model is not available") || r.includes("invalid model")) return guide("model", "The selected video engine is unavailable.", "Run Model availability check, then select an available provider.", ["Provider and model ID: confirm the displayed model is marked Available.", "Mode: confirm the model supports text-to-video or image-to-video as selected."]);
  if (r.includes("no_credits") || r.includes("http_402") || r.includes("insufficient credit")) return guide("billing", "The selected provider has insufficient credit.", "Top up the relevant provider or workspace credits, then retry.");
  if (r.includes("rate_limited") || r.includes("http_429")) return guide("rate_limit", "The provider rate limit was reached.", "Wait about a minute before retrying; avoid duplicate generation requests.");
  if (r.includes("replicate_api_key") || r.includes("replicate_http_401") || r.includes("replicate_http_403")) return guide("authentication", "The Replicate connection was rejected.", "Ask an administrator to reconnect Replicate or verify its server-side credential and permissions.");
  if (r.includes("lovable_api_key")) return guide("authentication", "The AI connection is not configured.", "Ask an administrator to verify the server-side AI connection.");
  if (r.includes("ark_api_key")) return guide("authentication", "The Seedance connection is not configured.", "Ask an administrator to configure the server-side Seedance credential.");
  if (r.includes("accessdenied") || r.includes("ark_http_403")) return guide("authentication", "Seedance access was denied.", "Ask an administrator to check credential permissions and endpoint configuration.", ["API credential: verify it belongs to the endpoint's project.", "Endpoint ID and base URL: verify both target the same region and project."]);
  if (r.includes("inference limit") || r.includes("safe experience mode")) return guide("billing", "Seedance is limited by Safe Experience mode.", "Ask an administrator to disable Safe Experience / Free Credits Only mode for the video model.");
  if (r.includes("modelnotopen") || r.includes("ark_http_404") || r.includes("ark_model_not_activated")) return guide("model", "The Seedance model is not activated.", "Ask an administrator to activate the configured video endpoint.", ["Endpoint ID: confirm it belongs to the same project as the API credential.", "Endpoint status: confirm it is Running."]);
  if (r.includes("signed_url_failed")) return guide("storage", "The reference image could not be loaded.", "Remove the reference, upload it again, and retry.", ["Reference role: confirm a First frame is assigned for image-to-video.", "File: use a supported JPG, PNG, or MP4 that can be previewed in the studio."]);
  if (r.includes("storage_upload_failed") || r.includes("fetch_video_failed")) return guide("storage", "The generated video could not be saved.", "The generation may have completed, but result storage failed. Retry once; if it repeats, contact the workspace administrator.");
  if (r.includes("no_task_id")) return guide("provider", "The provider did not return a task ID.", "Check the request settings, then retry.", ["Mode: use image-to-video only when a valid first frame is attached.", "Prompt: shorten unusually long text.", "Model version: confirm the configured version still exists."]);
  if (r.includes("http_400") || r.includes("http_422") || r.includes("validation") || r.includes("empty_prompt")) return guide("input", "The provider rejected one or more request parameters.", "Review the request values below and try again.", ["Positive prompt: required, maximum 4,000 characters.", "Negative prompt: maximum 2,000 characters.", "Duration: 3–12 seconds; try 5 seconds for widest compatibility.", "Resolution: try 720p.", "Aspect ratio: try 16:9 or 9:16.", "Image-to-video: attach a valid First frame; remove it for a text-only test."]);
  if (r.includes("http_401") || r.includes("http_403") || r.includes("unauthorized") || r.includes("forbidden")) return guide("authentication", "The provider rejected authentication or access.", "Ask an administrator to verify the connection, permissions, and selected model access.");
  if (r.includes("http_404")) return guide("model", "The configured model or endpoint was not found.", "Run Model availability check and verify the model / endpoint ID.");
  if (r.includes("http_408") || r.includes("timeout") || r.includes("timed out")) return guide("provider", "The provider timed out.", "Wait briefly and retry once. Use a 5-second, 720p request to reduce processing time.");
  if (r.includes("http_413")) return guide("input", "The request was too large.", "Reduce the reference file size or prompt length and retry.");
  if (/http_5\d\d/.test(r) || r.includes("service unavailable") || r.includes("bad gateway")) return guide("provider", "The video provider is temporarily unavailable.", "Your parameters may be valid. Wait briefly, run Model availability check, and retry once.", ["If the same 5xx repeats, check the provider status page before changing your prompt."]);
  return guide("unknown", "Video generation failed.", "Run Model availability check and retry once. If it repeats, share the technical details with an administrator.");
}

export function explainVideoError(raw: string): VideoErrorInfo {
  const [first, fallback] = raw.split("||");
  const selected = pick(raw);
  const diagnostic = fallback ? `Primary: ${(first ?? "").trim()} | Fallback: ${fallback.trim()}` : (first ?? raw).trim();
  return { ...selected, raw: diagnostic.slice(0, 300) };
}

export function formatVideoError(raw: string): string {
  const info = explainVideoError(raw);
  const checks = info.checks.map((item) => `• ${item}`).join("\n");
  return [info.title, info.hint, `Category: ${info.category.replace("_", " ")}`, checks ? `Check these parameters:\n${checks}` : "", `(raw: ${info.raw})`].filter(Boolean).join("\n");
}
