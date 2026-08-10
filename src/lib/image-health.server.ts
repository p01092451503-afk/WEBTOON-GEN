// Server-only helpers: 이미지 모델(ARK / Seedream) 연결 상태 점검.
// 실제 이미지 생성 요청은 만들지 않고 인증/설정 도달 여부만 확인한다.
import { normalizeArkBaseUrl } from "@/lib/generate.server";

export type ValidationState =
  | "valid"
  | "invalid"
  | "missing"
  | "available"
  | "unavailable"
  | "configured"
  | "not_configured"
  | "unknown";

/** 연동된 이미지 모델 세부 명칭 */
export const IMAGE_MODEL_NAME = "seedream-5-0-260128";

export type ImageModelHealth = {
  id: string;
  label: string;
  modelName: string;
  provider: "seedream";
  status: "available" | "unavailable" | "unknown";
  detail: string;
  /** i18n key suffix for the human-readable detail message. */
  detailCode: "missing_config" | "invalid_key" | "ready" | "no_endpoint" | "unreachable";
  validation: {
    credential: ValidationState;
    baseUrl: ValidationState;
    endpoint: ValidationState;
    configuredEndpoint: string | null;
  };
};

/** 엔드포인트 ID 는 앞뒤 일부만 노출한다. */
function maskEndpoint(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export async function probeSeedream(): Promise<ImageModelHealth> {
  const label = `Seedream (ARK) · ${IMAGE_MODEL_NAME}`;
  const key = process.env.ARK_API_KEY?.trim();
  const rawBase = process.env.ARK_BASE_URL?.trim();
  const base = rawBase ? normalizeArkBaseUrl(rawBase) : undefined;
  const endpoint = process.env.ARK_ENDPOINT_ID?.trim() || null;
  const masked = maskEndpoint(endpoint);

  if (!key || !base) {
    return {
      id: endpoint ?? "unknown",
      label,
      modelName: IMAGE_MODEL_NAME,
      provider: "seedream",
      status: "unavailable",
      detail: "이미지 생성에 필요한 ARK_API_KEY 또는 ARK_BASE_URL이 설정되지 않았습니다.",
      detailCode: "missing_config",
      validation: {
        credential: key ? "valid" : "missing",
        baseUrl: base ? "available" : "missing",
        endpoint: endpoint ? "configured" : "not_configured",
        configuredEndpoint: masked,
      },
    };
  }

  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (res.status === 401 || res.status === 403) {
      return {
        id: endpoint ?? "unknown",
        label,
        modelName: IMAGE_MODEL_NAME,
      provider: "seedream",
        status: "unavailable",
        detail: "저장된 ARK API 키가 거부되었습니다. 키가 활성 상태이고 엔드포인트와 같은 프로젝트인지 확인하세요.",
        detailCode: "invalid_key",
        validation: {
          credential: "invalid",
          baseUrl: "available",
          endpoint: endpoint ? "configured" : "not_configured",
          configuredEndpoint: masked,
        },
      };
    }

    let modelIds: string[] = [];
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as { data?: Array<{ id?: unknown }> } | null;
      modelIds = (body?.data ?? [])
        .map((item) => (typeof item.id === "string" ? item.id : ""))
        .filter(Boolean);
    }

    const endpointListed = endpoint ? modelIds.includes(endpoint) : false;
    const callable = Boolean(endpoint);

    return {
      id: endpoint ?? "unknown",
      label,
      modelName: IMAGE_MODEL_NAME,
      provider: "seedream",
      status: callable ? "available" : "unknown",
      detail: callable
        ? "ARK 인증에 성공했고 설정된 이미지 엔드포인트를 호출할 수 있습니다."
        : "ARK 인증에는 성공했지만 이미지 엔드포인트(ARK_ENDPOINT_ID)가 설정되지 않았습니다.",
      detailCode: callable ? "ready" : "no_endpoint",
      validation: {
        credential: "valid",
        baseUrl: "available",
        endpoint: endpoint ? (endpointListed ? "available" : "configured") : "not_configured",
        configuredEndpoint: masked,
      },
    };
  } catch {
    return {
      id: endpoint ?? "unknown",
      label,
      modelName: IMAGE_MODEL_NAME,
      provider: "seedream",
      status: "unknown",
      detail: "ARK 서비스에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.",
      detailCode: "unreachable",
      validation: {
        credential: "unknown",
        baseUrl: "available",
        endpoint: endpoint ? "configured" : "not_configured",
        configuredEndpoint: masked,
      },
    };
  }
}
