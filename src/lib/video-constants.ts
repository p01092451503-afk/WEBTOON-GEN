export const DEFAULT_VIDEO_NEGATIVE_PROMPT =
  "low quality, worst quality, deformed, distorted, blurry, watermark, text, static, jittery motion";

export type SeedanceResolution = "480p" | "720p" | "1080p";

/**
 * Official BytePlus worked examples for Dreamina Seedance 2.0 text/image-to-video,
 * normalized to USD per output second. Uploaded videos in the playground are
 * converted to image frames, so they do not incur video-to-video input tokens.
 */
export const SEEDANCE_2_USD_PER_OUTPUT_SECOND: Record<SeedanceResolution, number> = {
  "480p": 0.07,
  "720p": 0.152,
  "1080p": 0.374,
};

export function estimateSeedanceVideoCost(
  resolution: SeedanceResolution,
  durationSeconds: number,
) {
  return SEEDANCE_2_USD_PER_OUTPUT_SECOND[resolution] * durationSeconds;
}