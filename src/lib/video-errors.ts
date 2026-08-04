// 영상 생성 실패 메시지를 사용자가 이해할 수 있는 안내문으로 변환한다.
// 원본 오류는 진단용으로 뒤에 짧게 덧붙인다.

export type VideoErrorInfo = {
  /** 사용자에게 보여줄 한 줄 요약 */
  title: string;
  /** 다음에 무엇을 해야 하는지 */
  hint: string;
  /** 원본 오류(진단용, 최대 300자) */
  raw: string;
};

function pick(raw: string): { title: string; hint: string } {
  const r = raw.toLowerCase();

  // Lovable AI Gateway
  if (r.includes("model is not available") || r.includes("invalid model")) {
    return {
      title: "Lovable AI 워크스페이스에 영상 모델이 아직 열려 있지 않습니다.",
      hint: "현재 이 워크스페이스의 AI 게이트웨이는 텍스트·이미지·음성 모델만 제공하고 영상 모델(veo 등)이 포함되어 있지 않습니다. 영상 모델이 워크스페이스에 열린 뒤 다시 시도하거나, BytePlus Seedance 한도를 해제해 사용해 주세요.",
    };
  }

  if (r.includes("lovable_no_credits") || r.includes("402")) {
    return {
      title: "Lovable AI 크레딧이 부족합니다.",
      hint: "워크스페이스 설정에서 크레딧을 충전한 뒤 다시 시도해 주세요.",
    };
  }
  if (r.includes("lovable_rate_limited") || r.includes("429")) {
    return {
      title: "요청이 너무 많습니다.",
      hint: "잠시 후(약 1분) 다시 생성 버튼을 눌러 주세요.",
    };
  }
  if (r.includes("lovable_api_key")) {
    return {
      title: "Lovable AI 연결 설정이 없습니다.",
      hint: "관리자에게 Lovable AI 연결(API 키) 활성화를 요청해 주세요.",
    };
  }

  // Seedance / BytePlus ARK
  if (r.includes("inference limit") || r.includes("safe experience mode")) {
    return {
      title: "Seedance 계정이 안전 체험 모드(Free Credits Only)로 잠겨 있습니다.",
      hint: "BytePlus 콘솔 → ModelArk → Model Activation에서 'Safe Experience Mode / Free Credits Only Mode'를 해제해야 유료 생성이 가능합니다.",
    };
  }
  if (r.includes("modelnotopen") || r.includes("ark_http_404")) {
    return {
      title: "Seedance 모델이 활성화되어 있지 않습니다.",
      hint: "BytePlus 콘솔에서 해당 영상 모델을 Activate 한 뒤 다시 시도해 주세요.",
    };
  }
  if (r.includes("accessdenied") || r.includes("ark_http_403")) {
    return {
      title: "Seedance API 접근이 거부되었습니다.",
      hint: "API 키 권한과 모델/엔드포인트 ID 설정을 확인해 주세요.",
    };
  }
  if (r.includes("ark_api_key")) {
    return {
      title: "Seedance API 키가 설정되지 않았습니다.",
      hint: "관리자에게 ARK_API_KEY 등록을 요청해 주세요.",
    };
  }

  if (r.includes("signed_url_failed")) {
    return {
      title: "참조 이미지를 불러오지 못했습니다.",
      hint: "이미지를 다시 업로드한 뒤 시도해 주세요.",
    };
  }

  return {
    title: "영상 생성에 실패했습니다.",
    hint: "잠시 후 다시 시도하거나 '생성 엔진'을 바꿔 보세요.",
  };
}

/** 폴백까지 모두 실패한 경우 두 오류를 함께 정리한다. */
export function explainVideoError(raw: string): VideoErrorInfo {
  const [first] = raw.split("||");
  const { title, hint } = pick(raw);
  return { title, hint, raw: (first ?? raw).trim().slice(0, 300) };
}

/** 한 문자열로 합친 표시용 메시지 */
export function formatVideoError(raw: string): string {
  const info = explainVideoError(raw);
  return `${info.title}\n${info.hint}\n\n(원본: ${info.raw})`;
}
