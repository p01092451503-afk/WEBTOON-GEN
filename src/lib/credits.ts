/**
 * P7 — 크레딧 시스템 (선택 모듈)
 *
 * 원장(ledger)은 기존 usage_events 를 그대로 재사용하고,
 * "잔액(tenants.credit_balance) + 차감"만 얇게 추가한다.
 * 실제 차감/검증은 반드시 서버(generate 서버함수 + debit_tenant_credits)에서 수행한다.
 */

/** 이미지 1장당 크레딧 단가 (설정값) */
export const CR_PER_IMAGE = Number(import.meta.env.VITE_CR_PER_IMAGE ?? 6) || 6;

/**
 * 기능 플래그.
 * 환경변수 VITE_CREDITS_ENABLED=false 이면 전역 off (CR 표기 숨김 → 기존 usage-only 모드).
 * 그 외에는 tenants.credits_enabled 로 테넌트별 on/off.
 */
export const CREDITS_FEATURE_ENABLED =
  String(import.meta.env.VITE_CREDITS_ENABLED ?? "true").toLowerCase() !== "false";

export function estimateCredits(imageCount: number): number {
  return Math.max(0, Math.floor(imageCount)) * CR_PER_IMAGE;
}

export function formatCredits(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}
