// Server-only helpers for Lovable AI Gateway video generation.
// Seedance(ARK) 구현은 src/lib/video.server.ts 에 그대로 남아 있으며,
// 이 파일은 대체 프로바이더로만 사용된다. 클라이언트에서 import 금지.

import type { VideoTaskState, VideoTaskStatus } from "@/lib/video.server";
import { DEFAULT_VIDEO_NEGATIVE_PROMPT } from "@/lib/video-constants";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/videos";

/** taskId 앞에 붙는 프로바이더 표식. poll 시 어떤 API 로 조회할지 구분한다. */
export const LOVABLE_TASK_PREFIX = "lovable:";

export const DEFAULT_LOVABLE_VIDEO_MODEL = "google/veo-3.1-fast";

function apiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY 가 설정되지 않았습니다.");
  return key;
}

/** Lovable AI Gateway 는 별도 플래그 문법이 없으므로 옵션을 자연어로 덧붙인다. */
export function buildLovableVideoPrompt(params: {
  prompt: string;
  cameraFixed?: boolean;
  seed?: number | null;
}): string {
  const extras: string[] = [];
  if (params.cameraFixed) extras.push("Keep the camera completely static (no camera movement).");
  const base = params.prompt.trim();
  return extras.length > 0 ? `${base}\n\n${extras.join(" ")}` : base;
}

type GatewayVideoResponse = {
  id?: string;
  task_id?: string;
  status?: string;
  error?: { message?: string } | string;
  video?: { url?: string; b64_json?: string };
  data?: Array<{ url?: string; b64_json?: string }>;
};

function extractUrl(json: GatewayVideoResponse): string | undefined {
  return json.video?.url ?? json.data?.[0]?.url;
}

async function readError(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { message?: string; title?: string };
    return j.message ?? j.title ?? text;
  } catch {
    return text;
  }
}

/**
 * Lovable AI Gateway 로 영상 작업을 생성한다.
 * 즉시 결과 URL 을 주는 경우와 비동기 작업 ID 를 주는 경우를 모두 처리한다.
 */
export async function createLovableVideoTask(params: {
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio?: string | null;
  durationSeconds?: number | null;
  firstFrameUrl?: string | null;
  cameraFixed?: boolean;
  model?: string;
}): Promise<{ taskId: string; model: string }> {
  const model = params.model?.trim() || DEFAULT_LOVABLE_VIDEO_MODEL;
  const prompt = buildLovableVideoPrompt({
    prompt: params.prompt,
    cameraFixed: params.cameraFixed,
  });

  const body: Record<string, unknown> = {
    model,
    prompt,
  };
  if (params.aspectRatio && !params.firstFrameUrl) body.aspect_ratio = params.aspectRatio;
  if (params.durationSeconds) body.duration_seconds = params.durationSeconds;
  if (params.firstFrameUrl) body.image_url = params.firstFrameUrl;
  body.negative_prompt = params.negativePrompt?.trim() || DEFAULT_VIDEO_NEGATIVE_PROMPT;

  console.info("[video-provider-request]", {
    provider: "lovable",
    mode: params.firstFrameUrl ? "i2v" : "t2v",
    model,
    prompt: body.prompt,
    negative_prompt: body.negative_prompt,
    aspect_ratio: body.aspect_ratio,
    duration_seconds: body.duration_seconds,
    has_image: Boolean(body.image_url),
  });

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Lovable-API-Key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    throw new Error("LOVABLE_RATE_LIMITED: 요청량 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (res.status === 402) {
    throw new Error("LOVABLE_NO_CREDITS: Lovable AI 크레딧이 부족합니다. 워크스페이스에서 크레딧을 충전해 주세요.");
  }
  if (!res.ok) {
    const message = await readError(res);
    throw new Error(`LOVABLE_HTTP_${res.status}: ${message.slice(0, 500)}`);
  }

  const json = (await res.json()) as GatewayVideoResponse;
  const url = extractUrl(json);
  if (url) return { taskId: `${LOVABLE_TASK_PREFIX}url|${url}`, model };

  const id = json.id ?? json.task_id;
  if (!id) throw new Error("LOVABLE_NO_TASK_ID: 작업 ID 또는 결과 URL 을 받지 못했습니다.");
  return { taskId: `${LOVABLE_TASK_PREFIX}${id}`, model };
}

export function isLovableTaskId(taskId: string) {
  return taskId.startsWith(LOVABLE_TASK_PREFIX);
}

/** Lovable AI Gateway 작업 상태를 조회한다. */
export async function getLovableVideoTask(taskId: string): Promise<VideoTaskState> {
  const raw = taskId.slice(LOVABLE_TASK_PREFIX.length);
  if (raw.startsWith("url|")) {
    return { status: "succeeded", videoUrl: raw.slice(4) };
  }

  const res = await fetch(`${GATEWAY_URL}/${encodeURIComponent(raw)}`, {
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Lovable-API-Key": apiKey(),
    },
  });
  if (!res.ok) {
    const message = await readError(res);
    throw new Error(`LOVABLE_HTTP_${res.status}: ${message.slice(0, 500)}`);
  }

  const json = (await res.json()) as GatewayVideoResponse;
  const url = extractUrl(json);
  const state = (json.status ?? (url ? "succeeded" : "running")).toLowerCase();
  const status: VideoTaskStatus =
    state === "succeeded" || state === "completed" || state === "success"
      ? "succeeded"
      : state === "failed" || state === "error"
        ? "failed"
        : state === "cancelled" || state === "canceled"
          ? "cancelled"
          : state === "queued" || state === "pending"
            ? "queued"
            : "running";

  const errorMessage =
    typeof json.error === "string" ? json.error : json.error?.message ?? undefined;

  return { status, videoUrl: url, error: errorMessage };
}
