import { createReplicateVideoTask } from "@/lib/video-replicate.server";

export type VideoRecoveryAttempt = {
  provider: "replicate" | "seedance";
  stage: "start" | "poll" | "fallback";
  outcome: "failed" | "retrying" | "started";
  reason: string;
  at: string;
};

type ReplicateInput = Parameters<typeof createReplicateVideoTask>[0];

function safeReason(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

export function isRetryableVideoError(error: unknown) {
  const value = safeReason(error).toLowerCase();
  return (
    value.includes("http_429") ||
    /http_5\d\d/.test(value) ||
    value.includes("rate_limit") ||
    value.includes("timeout") ||
    value.includes("timed out") ||
    value.includes("fetch failed") ||
    value.includes("network") ||
    value.includes("econnreset") ||
    value.includes("temporarily unavailable") || value.includes("safe experience mode") || value.includes("inference limit")
  );
}

export function recoveryAttempt(
  provider: VideoRecoveryAttempt["provider"],
  stage: VideoRecoveryAttempt["stage"],
  outcome: VideoRecoveryAttempt["outcome"],
  reason: string,
): VideoRecoveryAttempt {
  return { provider, stage, outcome, reason: reason.slice(0, 500), at: new Date().toISOString() };
}

export async function createReplicateWithRetry(input: ReplicateInput) {
  const attempts: VideoRecoveryAttempt[] = [];
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const task = await createReplicateVideoTask(input);
      return { task, attempts };
    } catch (error) {
      const reason = safeReason(error);
      const willRetry = attempt < maxAttempts && isRetryableVideoError(error);
      attempts.push(
        recoveryAttempt("replicate", "start", willRetry ? "retrying" : "failed", reason),
      );
      if (!willRetry) throw Object.assign(new Error(reason), { recoveryAttempts: attempts });
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
  }

  throw new Error("VIDEO_START_RETRY_EXHAUSTED");
}

export function readRecoveryAttempts(options: unknown): VideoRecoveryAttempt[] {
  if (!options || typeof options !== "object" || Array.isArray(options)) return [];
  const value = (options as Record<string, unknown>).recoveryAttempts;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is VideoRecoveryAttempt =>
      Boolean(item) && typeof item === "object" && typeof (item as { reason?: unknown }).reason === "string",
  );
}

export function recoveryMessage(attempts: VideoRecoveryAttempt[]) {
  const fallback = [...attempts].reverse().find((item) => item.outcome === "started");
  if (fallback) {
    return "The primary video pipeline failed, so generation automatically switched to Seedance.";
  }
  const retry = [...attempts].reverse().find((item) => item.outcome === "retrying");
  return retry ? "A temporary provider error occurred. Retrying automatically…" : null;
}