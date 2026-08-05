// Server-only helpers: 영상 모델 가용 상태 점검.
// 실제 영상 작업을 만들지 않는 안전한 프로브만 사용한다.

export type ModelHealth = {
  id: string;
  label: string;
  provider: "seedance";
  status: "available" | "unavailable" | "unknown";
  detail: string;
  validation?: {
    credential: "valid" | "invalid" | "missing" | "unknown";
    model: "available" | "unavailable" | "unknown";
    endpoint: "available" | "configured" | "unavailable" | "not_configured" | "unknown";
    configuredEndpoint: string | null;
  };
};

/** Seedance(ARK) 는 설정값과 인증 도달 여부만 확인한다 (작업 생성 없음). */
export async function probeSeedance(): Promise<ModelHealth> {
  const seedance2Model = "dreamina-seedance-2-0-260128";
  const label = "Seedance 2.0";
  const key = process.env.ARK_API_KEY;
  const base = process.env.ARK_BASE_URL?.replace(/\/$/, "");
  const configuredEndpoint =
    process.env.ARK_VIDEO_ENDPOINT_ID?.trim() ||
    process.env.ARK_VIDEO_MODEL_ID?.trim();

  if (!key || !base) {
    return {
      id: seedance2Model,
      label,
      provider: "seedance",
      status: "unavailable",
      detail: "Seedance 2.0 연결에 필요한 ARK_API_KEY 또는 ARK_BASE_URL이 없습니다.",
      validation: {
        credential: key ? "unknown" : "missing",
        model: "unknown",
        endpoint: configuredEndpoint ? "unknown" : "not_configured",
        configuredEndpoint: configuredEndpoint ?? null,
      },
    };
  }

  try {
    const headers = { Authorization: `Bearer ${key}` };
    const [authResponse, modelsResponse] = await Promise.all([
      fetch(`${base}/contents/generations/tasks/health-probe-000`, { headers }),
      fetch(`${base}/models`, { headers }),
    ]);

    if (
      authResponse.status === 401 ||
      authResponse.status === 403 ||
      modelsResponse.status === 401 ||
      modelsResponse.status === 403
    ) {
      return {
        id: seedance2Model,
        label,
        provider: "seedance",
        status: "unavailable",
        detail: "The saved ARK API key was rejected. Verify that the key is active and belongs to the same BytePlus project as the video endpoint.",
        validation: {
          credential: "invalid",
          model: "unknown",
          endpoint: configuredEndpoint ? "unknown" : "not_configured",
          configuredEndpoint: configuredEndpoint ?? null,
        },
      };
    }

    let modelIds: string[] = [];
    if (modelsResponse.ok) {
      const body = (await modelsResponse.json().catch(() => null)) as
        | { data?: Array<{ id?: unknown }> }
        | null;
      modelIds = (body?.data ?? [])
        .map((item) => (typeof item.id === "string" ? item.id : ""))
        .filter(Boolean);
    }

    const modelAvailable = modelIds.includes(seedance2Model);
    // ARK endpoint IDs (ep-...) are invocation targets, not model catalog
    // entries. Their absence from GET /models does not mean they are invalid.
    const endpointListedAsModel = configuredEndpoint
      ? modelIds.includes(configuredEndpoint)
      : false;
    const endpointConfigured = Boolean(configuredEndpoint);
    const catalogReadable = modelsResponse.ok;
    const callableTargetAvailable = modelAvailable || endpointConfigured;

    return {
      id: seedance2Model,
      label,
      provider: "seedance",
      status: callableTargetAvailable ? "available" : "unknown",
      detail: callableTargetAvailable
        ? `ARK authentication succeeded and ${endpointConfigured ? "the configured Seedance 2.0 endpoint" : "Seedance 2.0"} is available.`
        : catalogReadable
          ? "ARK authentication succeeded, but Seedance 2.0 or the configured endpoint was not returned by the model catalog. Check model activation and project ownership."
          : "ARK authentication succeeded. The model catalog is unavailable, so the model will be confirmed when generation starts.",
      validation: {
        credential: "valid",
        model: catalogReadable ? (modelAvailable ? "available" : "unavailable") : "unknown",
        endpoint: endpointConfigured
          ? endpointListedAsModel
            ? "available"
            : "configured"
          : "not_configured",
        configuredEndpoint: configuredEndpoint ?? null,
      },
    };
  } catch {
    return {
      id: seedance2Model,
      label,
      provider: "seedance",
      status: "unknown",
      detail: "The Seedance service could not be reached. Check the connection again in a few moments.",
      validation: {
        credential: "unknown",
        model: "unknown",
        endpoint: configuredEndpoint ? "unknown" : "not_configured",
        configuredEndpoint: configuredEndpoint ?? null,
      },
    };
  }
}


