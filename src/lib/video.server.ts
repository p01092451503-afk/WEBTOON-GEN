// Server-only helpers for Seedance (BytePlus ARK) video generation.
// This file must NOT be imported from client code.

export type VideoTaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type VideoTaskState = {
  status: VideoTaskStatus;
  videoUrl?: string;
  error?: string;
};

function arkEnv() {
  const ARK_API_KEY = process.env.ARK_API_KEY;
  const ARK_BASE_URL = process.env.ARK_BASE_URL;
  // Ark inference requests should prefer the account-specific endpoint ID.
  // A catalog model ID may exist in the environment while that model is not
  // activated for the account, which causes ModelNotOpen even when a valid
  // inference endpoint has already been configured.
  const model = process.env.ARK_VIDEO_ENDPOINT_ID || process.env.ARK_VIDEO_MODEL_ID;
  if (!ARK_API_KEY || !ARK_BASE_URL) {
    throw new Error("ARK 시크릿이 설정되지 않았습니다.");
  }
  if (!model) {
    throw new Error(
      "ARK_VIDEO_ENDPOINT_ID 또는 ARK_VIDEO_MODEL_ID가 설정되지 않았습니다. 활성화된 Seedance 엔드포인트 ID를 등록해 주세요.",
    );
  }
  return {
    key: ARK_API_KEY,
    base: ARK_BASE_URL.replace(/\/$/, ""),
    model,
  };
}

export function buildSeedanceText(params: {
  prompt: string;
  aspectRatio?: string | null;
  resolution?: string | null;
  durationSeconds?: number | null;
  cameraFixed?: boolean;
  seed?: number | null;
  hasFirstFrame?: boolean;
}): string {
  const flags: string[] = [];
  // 이미지→영상(i2v)에서는 비율이 입력 이미지로 결정되므로 ratio 플래그를 생략한다.
  if (params.aspectRatio && !params.hasFirstFrame) flags.push(`--ratio ${params.aspectRatio}`);
  if (params.resolution) flags.push(`--resolution ${params.resolution}`);
  if (params.durationSeconds) flags.push(`--duration ${params.durationSeconds}`);
  flags.push(`--camerafixed ${params.cameraFixed ? "true" : "false"}`);
  flags.push("--watermark false");
  if (params.seed != null) flags.push(`--seed ${params.seed}`);
  return `${params.prompt.trim()} ${flags.join(" ")}`.trim();
}

/** Seedance 비동기 작업을 생성하고 task id 를 반환한다. */
export async function createVideoTask(params: {
  text: string;
  firstFrameUrl?: string | null;
  lastFrameUrl?: string | null;
}): Promise<{ taskId: string; model: string }> {
  const { key, base, model } = arkEnv();

  const content: Array<Record<string, unknown>> = [{ type: "text", text: params.text }];
  if (params.firstFrameUrl) {
    content.push({
      type: "image_url",
      image_url: { url: params.firstFrameUrl },
      role: "first_frame",
    });
  }
  if (params.lastFrameUrl) {
    content.push({
      type: "image_url",
      image_url: { url: params.lastFrameUrl },
      role: "last_frame",
    });
  }

  const res = await fetch(`${base}/contents/generations/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, content }),
  });

  if (res.status === 429) {
    throw new Error("ARK_RATE_LIMITED: 요청량 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (text.includes("ModelNotOpen") || text.includes("has not activated the model")) {
      throw new Error(
        `ARK_MODEL_NOT_ACTIVATED: 현재 등록된 Seedance 엔드포인트/모델 "${model}"을 사용할 수 없습니다. Ark 콘솔에서 활성화된 Online Inference Endpoint ID를 확인한 뒤 ARK_VIDEO_ENDPOINT_ID 값을 갱신해 주세요.`,
      );
    }
    throw new Error(`ARK_HTTP_${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as { id?: string };
  if (!json?.id) throw new Error("ARK_NO_TASK_ID: 작업 ID를 받지 못했습니다.");
  return { taskId: json.id, model };
}

/** Seedance 작업 상태를 조회한다. */
export async function getVideoTask(taskId: string): Promise<VideoTaskState> {
  const { key, base } = arkEnv();
  const res = await fetch(`${base}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ARK_HTTP_${res.status}: ${text.slice(0, 500)}`);
  }
  const json = (await res.json()) as {
    status?: string;
    content?: { video_url?: string };
    error?: { message?: string; code?: string };
  };
  const raw = (json.status ?? "").toLowerCase();
  const status: VideoTaskStatus =
    raw === "succeeded"
      ? "succeeded"
      : raw === "failed"
        ? "failed"
        : raw === "cancelled" || raw === "canceled"
          ? "cancelled"
          : raw === "running"
            ? "running"
            : "queued";
  return {
    status,
    videoUrl: json.content?.video_url,
    error: json.error?.message ?? (json.error?.code ? String(json.error.code) : undefined),
  };
}
