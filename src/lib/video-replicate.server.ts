// Server-only helpers for Replicate video generation.
// This file must NOT be imported from client code.

import type { VideoTaskState, VideoTaskStatus } from "@/lib/video.server";
import { DEFAULT_VIDEO_NEGATIVE_PROMPT } from "@/lib/video-constants";

const REPLICATE_API_URL = "https://api.replicate.com/v1";

export const REPLICATE_TASK_PREFIX = "replicate:";

/** 텍스트→영상 기본 모델. 환경 변수로 덮어쓸 수 있다. */
export const DEFAULT_REPLICATE_TEXT_MODEL = "lightricks/ltx-video";
export const DEFAULT_REPLICATE_TEXT_VERSION =
  "8c47da666861d081eeb4d1261853087de23923a268a69b63febdf5dc1dee08e4";

/** 이미지→영상 기본 모델. 환경 변수로 덮어쓸 수 있다. */
export const DEFAULT_REPLICATE_IMAGE_MODEL = "wan-video/wan-2.2-i2v-fast";
export const DEFAULT_REPLICATE_IMAGE_VERSION =
  "4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea";

function apiKey() {
  const key = process.env.REPLICATE_API_KEY;
  if (!key) throw new Error("REPLICATE_API_KEY가 설정되지 않았습니다.");
  return key;
}

function headers() {
  return {
    Authorization: `Token ${apiKey()}`,
    "Content-Type": "application/json",
  };
}

async function readError(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { detail?: string; message?: string; title?: string };
    return j.detail ?? j.message ?? j.title ?? text;
  } catch {
    return text;
  }
}

const LTX_ASPECT_RATIOS = [
  "1:1",
  "1:2",
  "2:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "9:21",
  "21:9",
];
const LTX_LENGTHS = [97, 129, 161, 193, 225, 257];

/** LTX Video 가 허용하는 화면비만 통과시킨다. */
function ltxAspectRatio(aspectRatio: string) {
  return LTX_ASPECT_RATIOS.includes(aspectRatio) ? aspectRatio : "16:9";
}

/** 해상도 목표를 LTX 의 target_size enum 값으로 변환한다. */
function ltxTargetSize(resolution: string) {
  if (resolution === "1080p") return 1024;
  if (resolution === "720p") return 768;
  return 512;
}

/** duration(초)를 LTX 가 허용하는 프레임 수 enum 중 가까운 값으로 변환한다(24fps 기준). */
function ltxLength(durationSeconds: number) {
  const target = durationSeconds * 24;
  return LTX_LENGTHS.reduce((best, v) =>
    Math.abs(v - target) < Math.abs(best - target) ? v : best,
  );
}

/** WAN i2v 는 81~121 프레임(16fps)만 허용한다. */
function wanFrames(durationSeconds: number) {
  return Math.min(121, Math.max(81, Math.round(durationSeconds * 16)));
}

export function isReplicateTaskId(taskId: string) {
  return taskId.startsWith(REPLICATE_TASK_PREFIX);
}

type ReplicatePrediction = {
  id?: string;
  status?: string;
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string };
};

function extractVideoUrl(json: ReplicatePrediction): string | undefined {
  if (!json.output) return undefined;
  if (typeof json.output === "string") return json.output;
  if (Array.isArray(json.output)) return json.output.find((o) => typeof o === "string");
  return undefined;
}

/** Replicate prediction 을 생성한다. */
export async function createReplicateVideoTask(params: {
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio?: string | null;
  resolution?: string | null;
  durationSeconds?: number | null;
  firstFrameUrl?: string | null;
  lastFrameUrl?: string | null;
  seed?: number | null;
}): Promise<{ taskId: string; model: string; modelVersion: string }> {
  const isImageToVideo = Boolean(params.firstFrameUrl);
  const model = isImageToVideo ? DEFAULT_REPLICATE_IMAGE_MODEL : DEFAULT_REPLICATE_TEXT_MODEL;
  const modelVersion = isImageToVideo
    ? DEFAULT_REPLICATE_IMAGE_VERSION
    : DEFAULT_REPLICATE_TEXT_VERSION;

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    negative_prompt: params.negativePrompt?.trim() || DEFAULT_VIDEO_NEGATIVE_PROMPT,
  };

  if (params.seed != null) {
    input.seed = params.seed;
  }

  if (isImageToVideo) {
    input.image = params.firstFrameUrl;
    if (params.lastFrameUrl) input.last_image = params.lastFrameUrl;
    input.resolution = params.resolution === "480p" ? "480p" : "720p";
    if (params.durationSeconds) input.num_frames = wanFrames(params.durationSeconds);
    input.disable_safety_checker = false;
  } else {
    input.aspect_ratio = ltxAspectRatio(params.aspectRatio || "16:9");
    input.target_size = ltxTargetSize(params.resolution || "720p");
    if (params.durationSeconds) input.length = ltxLength(params.durationSeconds);
  }

  console.info("[video-provider-request]", {
    provider: "replicate",
    mode: isImageToVideo ? "i2v" : "t2v",
    model,
    modelVersion,
    prompt: input.prompt,
    negative_prompt: input.negative_prompt,
    aspect_ratio: input.aspect_ratio,
    target_size: input.target_size,
    length: input.length,
    resolution: input.resolution,
    num_frames: input.num_frames,
  });

  const res = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ version: modelVersion, input }),
  });

  if (res.status === 402) {
    throw new Error(
      "REPLICATE_NO_CREDITS: Replicate 계정에 크레딧이 부족합니다. replicate.com/account/billing 에서 결제 정보를 등록해 주세요.",
    );
  }
  if (!res.ok) {
    const message = await readError(res);
    throw new Error(`REPLICATE_HTTP_${res.status}: ${message.slice(0, 500)}`);
  }

  const json = (await res.json()) as ReplicatePrediction;
  const id = json.id;
  if (!id) throw new Error("REPLICATE_NO_TASK_ID: Replicate 작업 ID 를 받지 못했습니다.");
  return { taskId: `${REPLICATE_TASK_PREFIX}${id}`, model, modelVersion };
}

/** Replicate 작업 상태를 조회한다. */
export async function getReplicateVideoTask(taskId: string): Promise<VideoTaskState> {
  const raw = taskId.slice(REPLICATE_TASK_PREFIX.length);
  const res = await fetch(`${REPLICATE_API_URL}/predictions/${encodeURIComponent(raw)}`, {
    headers: { Authorization: headers()["Authorization"] },
  });

  if (!res.ok) {
    const message = await readError(res);
    throw new Error(`REPLICATE_HTTP_${res.status}: ${message.slice(0, 500)}`);
  }

  const json = (await res.json()) as ReplicatePrediction;
  const rawStatus = (json.status ?? "").toLowerCase();
  const status: VideoTaskStatus =
    rawStatus === "succeeded" || rawStatus === "success"
      ? "succeeded"
      : rawStatus === "failed" || rawStatus === "error"
        ? "failed"
        : rawStatus === "cancelled" || rawStatus === "canceled"
          ? "cancelled"
          : "running";

  return {
    status,
    videoUrl: extractVideoUrl(json),
    error: json.error ? String(json.error) : undefined,
  };
}

/** Replicate 연결 및 크레딧 상태를 간접 확인한다. */
export async function probeReplicate(): Promise<{
  id: string;
  label: string;
  provider: "replicate";
  status: "available" | "unavailable" | "unknown";
  detail: string;
}> {
  const key = process.env.REPLICATE_API_KEY;
  if (!key) {
    return {
      id: "replicate",
      label: "Replicate\u00a0",
      provider: "replicate",
      status: "unavailable",
      detail: "REPLICATE_API_KEY 가 설정되지 않았습니다.",
    };
  }

  try {
    const res = await fetch(`${REPLICATE_API_URL}/models/${DEFAULT_REPLICATE_TEXT_MODEL}`, {
      headers: { Authorization: `Token ${key}` },
    });
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      return {
        id: "replicate",
        label: "Replicate\u00a0",
        provider: "replicate",
        status: "unavailable",
        detail: "API 키 인증에 실패했습니다(401/403). 키 값을 다시 확인해 주세요.",
      };
    }
    if (res.status === 402) {
      return {
        id: "replicate",
        label: "Replicate\u00a0",
        provider: "replicate",
        status: "unavailable",
        detail:
          "Replicate 계정에 크레딧이 부족합니다. replicate.com/account/billing 에서 결제 정보를 확인해 주세요.",
      };
    }
    if (!res.ok) {
      return {
        id: "replicate",
        label: "Replicate\u00a0",
        provider: "replicate",
        status: "unknown",
        detail: `HTTP ${res.status}: ${text.slice(0, 160)}`,
      };
    }
    return {
      id: "replicate",
      label: "Replicate\u00a0",
      provider: "replicate",
      status: "available",
      detail: "API 인증 및 모델 조회가 정상입니다. 영상 생성이 가능합니다.",
    };
  } catch (err) {
    return {
      id: "replicate",
      label: "Replicate\u00a0",
      provider: "replicate",
      status: "unknown",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
