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
  // Ark 는 계정마다 사용 가능한 식별자가 다르다.
  // (1) Online Inference Endpoint ID, (2) 활성화된 카탈로그 모델 ID.
  // 어떤 값이 유효한지 사전에 알 수 없으므로 후보를 순서대로 시도한다.
  const candidates = [
    process.env.ARK_VIDEO_ENDPOINT_ID,
    process.env.ARK_VIDEO_MODEL_ID,
    process.env.ARK_ENDPOINT_ID,
  ]
    .map((v) => (v ?? "").trim())
    .filter((v, i, arr) => v.length > 0 && arr.indexOf(v) === i);

  if (!ARK_API_KEY || !ARK_BASE_URL) {
    throw new Error("ARK 시크릿이 설정되지 않았습니다.");
  }
  if (candidates.length === 0) {
    throw new Error(
      "ARK_VIDEO_ENDPOINT_ID 또는 ARK_VIDEO_MODEL_ID가 설정되지 않았습니다. 활성화된 Seedance 엔드포인트 ID를 등록해 주세요.",
    );
  }
  return {
    key: ARK_API_KEY,
    base: ARK_BASE_URL.replace(/\/$/, ""),
    candidates,
    model: candidates[0]!,
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
  const { key, base, candidates } = arkEnv();

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

  const failures: string[] = [];

  for (const model of candidates) {
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

    if (res.ok) {
      const json = (await res.json()) as { id?: string };
      if (!json?.id) throw new Error("ARK_NO_TASK_ID: 작업 ID를 받지 못했습니다.");
      return { taskId: json.id, model };
    }

    const text = await res.text().catch(() => "");
    failures.push(`${model} → HTTP ${res.status} ${text.slice(0, 200)}`);

    // 접근 불가/미활성 식별자는 다음 후보로 자동 폴백한다.
    const recoverable =
      res.status === 403 ||
      res.status === 404 ||
      text.includes("ModelNotOpen") ||
      text.includes("AccessDenied") ||
      text.includes("has not activated the model");
    if (!recoverable) {
      throw new Error(`ARK_HTTP_${res.status}: ${text.slice(0, 500)}`);
    }
  }

  throw new Error(
    "ARK_MODEL_NOT_ACTIVATED: 등록된 Seedance 식별자를 모두 시도했지만 사용할 수 없습니다. " +
      "BytePlus Ark 콘솔 → Online Inference 에서 Seedance 엔드포인트가 '실행 중(Running)' 상태이고, " +
      "해당 엔드포인트를 만든 프로젝트와 동일한 프로젝트의 API Key 를 사용 중인지 확인한 뒤 " +
      "ARK_VIDEO_ENDPOINT_ID / ARK_API_KEY 를 갱신해 주세요. 시도 내역: " +
      failures.join(" | "),
  );
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
