// Converts raw video generation failures into user-readable guidance.
// The original error is appended briefly for diagnostics.

export type VideoErrorInfo = {
  /** One-line summary shown to the user */
  title: string;
  /** What to do next */
  hint: string;
  /** Raw error (diagnostics, max 300 chars) */
  raw: string;
};

function pick(raw: string): { title: string; hint: string } {
  const r = raw.toLowerCase();

  if (r.includes("content_blocked"))
    return {
      title: "This request cannot be generated.",
      hint: "Remove explicit, exploitative, non-consensual, hateful, or graphically violent content and try again.",
    };
  if (r.includes("content_check"))
    return {
      title: "The safety check is temporarily unavailable.",
      hint: "Your request was not sent to the video provider. Try again shortly.",
    };
  if (r.includes("unresolved_media_mention"))
    return {
      title: "A media mention could not be resolved.",
      hint: "Choose the reference again from the @ menu before generating.",
    };

  // Lovable AI Gateway
  if (r.includes("model is not available") || r.includes("invalid model")) {
    return {
      title: "No video model is enabled for this AI workspace yet.",
      hint: "The AI gateway currently exposes text, image and audio models only — no video models. If you are using the Replicate integration, check its status in “Model availability check” below.",
    };
  }

  if (r.includes("lovable_no_credits") || r.includes("lovable_http_402")) {
    return {
      title: "Your AI credits have run out.",
      hint: "Top up credits in your workspace settings and try again.",
    };
  }
  if (r.includes("lovable_rate_limited") || r.includes("lovable_http_429")) {
    return {
      title: "Too many AI requests at once.",
      hint: "Wait about a minute and press Generate again.",
    };
  }
  if (r.includes("lovable_api_key")) {
    return {
      title: "The AI connection is not configured.",
      hint: "Ask an administrator to enable the AI connection (API key).",
    };
  }

  // Replicate
  if (
    r.includes("replicate_no_credits") ||
    r.includes("replicate_http_402") ||
    r.includes("insufficient credit")
  ) {
    return {
      title: "Your Replicate account is out of credit.",
      hint: "Add a payment method and top up at replicate.com/account/billing, then try again. A credit card is required for the first charge.",
    };
  }
  if (
    r.includes("replicate_api_key") ||
    r.includes("replicate_http_401") ||
    r.includes("replicate_http_403")
  ) {
    return {
      title: "The Replicate API key is invalid.",
      hint: "Create a new token at replicate.com/account/api-tokens and save it in the project settings.",
    };
  }
  if (r.includes("replicate_http_429")) {
    return {
      title: "Replicate rate limit reached.",
      hint: "Accounts without a payment method have a very low per-minute limit. Add a card and top up at replicate.com/account/billing, then retry.",
    };
  }
  if (r.includes("replicate_no_task_id")) {
    return {
      title: "Replicate did not return a task ID.",
      hint: "Your input may be too long or unsupported by the model. Shorten the prompt, or confirm you picked an image-to-video model.",
    };
  }
  if (r.includes("replicate_http_")) {
    return {
      title: "The Replicate API call failed.",
      hint: "Try again shortly. If it keeps failing, check replicate.statuspage.io.",
    };
  }

  // Seedance / BytePlus ARK
  if (r.includes("inference limit") || r.includes("safe experience mode")) {
    return {
      title: "Your Seedance account is locked in Safe Experience (Free Credits Only) mode.",
      hint: "In the BytePlus console → ModelArk → Model Activation, turn off “Safe Experience Mode / Free Credits Only Mode” to allow paid generation.",
    };
  }
  if (r.includes("modelnotopen") || r.includes("ark_http_404")) {
    return {
      title: "The Seedance model is not activated.",
      hint: "Activate the video model in the BytePlus console, then try again.",
    };
  }
  if (r.includes("accessdenied") || r.includes("ark_http_403")) {
    return {
      title: "Seedance API access was denied.",
      hint: "Check the API key permissions and the model / endpoint ID settings.",
    };
  }
  if (r.includes("ark_api_key")) {
    return {
      title: "The Seedance API key is not configured.",
      hint: "Ask an administrator to register ARK_API_KEY.",
    };
  }

  if (r.includes("signed_url_failed")) {
    return {
      title: "The reference image could not be loaded.",
      hint: "Upload the image again and retry.",
    };
  }

  return {
    title: "Video generation failed.",
    hint: "Try again shortly. If it keeps failing, run “Model availability check” below to inspect video model status.",
  };
}

/** Combines both errors when the fallback also failed. */
export function explainVideoError(raw: string): VideoErrorInfo {
  const [first] = raw.split("||");
  const { title, hint } = pick(raw);
  return { title, hint, raw: (first ?? raw).trim().slice(0, 300) };
}

/** Single display string */
export function formatVideoError(raw: string): string {
  const info = explainVideoError(raw);
  return `${info.title}\n${info.hint}\n\n(raw: ${info.raw})`;
}
