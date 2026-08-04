// Server-only helpers: 영상 모델 가용 상태 점검.
// 실제 영상 작업을 만들지 않는 안전한 프로브만 사용한다.

export type ModelHealth = {
  id: string;
  label: string;
  provider: "lovable" | "seedance" | "replicate";
  status: "available" | "unavailable" | "unknown";
  detail: string;
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/videos";


/**
 * 빈 프롬프트로 프로브를 보낸다.
 * - "model is not available" → 아직 워크스페이스에서 열리지 않은 모델
 * - "invalid model: ..."     → 게이트웨이 카탈로그에 없는 모델
 * - 그 외 400(프롬프트 검증 오류) 또는 2xx → 모델 자체는 사용 가능
 */
export async function probeLovableVideoModel(model: string, label: string): Promise<ModelHealth> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    return {
      id: model,
      label,
      provider: "lovable",
      status: "unknown",
      detail: "LOVABLE_API_KEY 가 설정되지 않았습니다.",
    };
  }

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, prompt: "" }),
    });
    const text = await res.text().catch(() => "");
    const lower = text.toLowerCase();

    if (res.status === 402) {
      return { id: model, label, provider: "lovable", status: "unavailable", detail: "Lovable AI 크레딧이 부족합니다." };
    }
    if (res.status === 429) {
      return { id: model, label, provider: "lovable", status: "unknown", detail: "요청량 제한으로 확인하지 못했습니다. 잠시 후 다시 점검해 주세요." };
    }
    if (lower.includes("model is not available")) {
      return { id: model, label, provider: "lovable", status: "unavailable", detail: "이 워크스페이스에서 아직 열리지 않은 모델입니다." };
    }
    if (lower.includes("invalid model")) {
      return { id: model, label, provider: "lovable", status: "unavailable", detail: "게이트웨이 카탈로그에 없는 모델 ID 입니다." };
    }
    if (res.ok || res.status === 400) {
      return { id: model, label, provider: "lovable", status: "available", detail: "모델 호출이 허용됩니다. 영상 생성이 가능합니다." };
    }
    return { id: model, label, provider: "lovable", status: "unknown", detail: `HTTP ${res.status}: ${text.slice(0, 160)}` };
  } catch (err) {
    return {
      id: model,
      label,
      provider: "lovable",
      status: "unknown",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Seedance(ARK) 는 설정값과 인증 도달 여부만 확인한다 (작업 생성 없음). */
export async function probeSeedance(): Promise<ModelHealth> {
  const label = "Seedance (BytePlus ARK)";
  const key = process.env.ARK_API_KEY;
  const base = process.env.ARK_BASE_URL?.replace(/\/$/, "");
  const endpoint =
    process.env.ARK_VIDEO_ENDPOINT_ID?.trim() ||
    process.env.ARK_VIDEO_MODEL_ID?.trim() ||
    process.env.ARK_ENDPOINT_ID?.trim();

  if (!key || !base || !endpoint) {
    return {
      id: endpoint ?? "seedance",
      label,
      provider: "seedance",
      status: "unavailable",
      detail: "ARK_API_KEY / ARK_BASE_URL / ARK_VIDEO_ENDPOINT_ID 중 누락된 값이 있습니다.",
    };
  }

  try {
    const res = await fetch(`${base}/contents/generations/tasks/health-probe-000`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401 || res.status === 403) {
      return {
        id: endpoint,
        label,
        provider: "seedance",
        status: "unavailable",
        detail: "Authentication failed. Ask an administrator to verify the Seedance connection and permissions.",
      };
    }
    return {
      id: endpoint,
      label,
      provider: "seedance",
      status: "unknown",
      detail:
        "Authentication is working. Model activation and Safe Experience mode can only be confirmed when a real generation starts.",
    };
  } catch {
    return {
      id: endpoint,
      label,
      provider: "seedance",
      status: "unknown",
      detail: "The Seedance service could not be reached. Check the connection again in a few moments.",
    };
  }
}

export { probeReplicate } from "@/lib/video-replicate.server";

