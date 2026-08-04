// Server-only helpers for Replicate video generation.
// This file must NOT be imported from client code.

import type { VideoTaskState, VideoTaskStatus } from "@/lib/video.server";

const REPLICATE_API_URL = "https://api.replicate.com/v1";

export const REPLICATE_TASK_PREFIX = "replicate:";

/** 텍스트→영상 기본 모델. 환경 변수로 덮어쓸 수 있다. */
export const DEFAULT_REPLICATE_TEXT_MODEL =
  process.env.REPLICATE_TEXT_TO_VIDEO_MODEL?.trim() || "lightricks/ltx-video";

/** 이미지→영상 기본 모델. 환경 변수로 덮어쓸 수 있다. */
export const DEFAULT_REPLICATE_IMAGE_MODEL =
  process.env.REPLICATE_IMAGE_TO_VIDEO_MODEL?.trim() || "wan-video/wan-2.1-i2v-14b-480p";

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

/** 종횡비와 해상도 목표에 맞춰 width/height 를 계산한다. 모델 호환을 위해 8의 배수로 내림한다. */
function computeSize(aspectRatio: string, resolution: string) {
  const [rw, rh] = aspectRatio.split(":").map((n) => Number(n.trim()));
  const ratio = rw && rh ? rw / rh : 16 / 9;

  const targetPixels =
    resolution === "1080p"
      ? 1920 * 1080
      : resolution === "720p"
        ? 1280 * 720
        : 854 * 480;

  const height = Math.floor(Math.sqrt(targetPixels / ratio) / 8) * 8;
  const width = Math.floor((height * ratio) / 8) * 8;

  return { width: Math.max(8, width), height: Math.max(8, height) };
}

/** duration(초)를 24fps 기준 프레임 수로 변환한다. */
function computeFrames(durationSeconds: number) {
  return Math.min(257, Math.max(24, Math.round(durationSeconds * 24)));
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
  aspectRatio?: string | null;
  resolution?: string | null;
  durationSeconds?: number | null;
  firstFrameUrl?: string | null;
  lastFrameUrl?: string | null;
  seed?: number | null;
}): Promise<{ taskId: string; model: string }> {
  const isImageToVideo = Boolean(params.firstFrameUrl);
  const model = isImageToVideo ? DEFAULT_REPLICATE_IMAGE_MODEL : DEFAULT_REPLICATE_TEXT_MODEL;

  const input: Record<string, unknown> = {
    prompt: params.prompt,
  };

  if (params.seed != null) {
    input.seed = params.seed;
  }

  if (isImageToVideo) {
    input.image = params.firstFrameUrl;
  } else {
    const size = computeSize(params.aspectRatio || "16:9", params.resolution || "720p");
    input.width = size.width;
    input.height = size.height;
    if (params.durationSeconds) {
      input.num_frames = computeFrames(params.durationSeconds);
    }
  }

  const res = await fetch(`${REPLICATE_API_URL}/models/${encodeURIComponent(model)}/predictions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ input }),
  });

  if (res.status === 402) {
    throw new Error("REPLICATE_NO_CREDITS: Replicate 계정에 크레딧이 부족합니다. replicate.com/account/billing 에서 결제 정보를 등록해 주세요.");
  }
  if (!res.ok) {
    const message = await readError(res);
    throw new Error(`REPLICATE_HTTP_${res.status}: ${message.slice(0, 500)}`);
  }

  const json = (await res.json()) as ReplicatePrediction;
  const id = json.id;
  if (!id) throw new Error("REPLICATE_NO_TASK_ID: Replicate 작업 ID 를 받지 못했습니다.");
  return { taskId: `${REPLICATE_TASK_PREFIX}${id}`, model };
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
      label: "Replicate (Lovable 직접 연동)",
      provider: "replicate",
      status: "unavailable",
      detail: "REPLICATE_API_KEY 가 설정되지 않았습니다.",
    };
  }

  try {
    const res = await fetch(`${REPLICATE_API_URL}/models/${encodeURIComponent(DEFAULT_REPLICATE_TEXT_MODEL)}`, {
      headers: { Authorization: `Token ${key}` },
    });
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      return {
        id: "replicate",
        label: "Replicate (Lovable 직접 연동)",
        provider: "replicate",
        status: "unavailable",
        detail: "API 키 인증에 실패했습니다(401/403). 키 값을 다시 확인해 주세요.",
      };
    }
    if (res.status === 402) {
      return {
        id: "replicate",
        label: "Replicate (Lovable 직접 연동)",
        provider: "replicate",
        status: "unavailable",
        detail: "Replicate 계정에 크레딧이 부족합니다. replicate.com/account/billing 에서 결제 정보를 확인해 주세요.",
      };
    }
    if (!res.ok) {
      return {
        id: "replicate",
        label: "Replicate (Lovable 직접 연동)",
        provider: "replicate",
        status: "unknown",
        detail: `HTTP ${res.status}: ${text.slice(0, 160)}`,
      };
    }
    return {
      id: "replicate",
      label: "Replicate (Lovable 직접 연동)",
      provider: "replicate",
      status: "available",
      detail: "API 인증 및 모델 조회가 정상입니다. 영상 생성이 가능합니다.",
    };
  } catch (err) {
    return {
      id: "replicate",
      label: "Replicate (Lovable 직접 연동)",
      provider: "replicate",
      status: "unknown",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
