// 이미지 그룹 → 만들기 스튜디오 레퍼런스 주입용 브리지.
// storage path 만 전달한다(base64 금지).
import type { RoleTag } from "@/lib/studioRefs";

const KEY = "toonpilot:pendingRefs";

export type PendingRef = { path: string; name?: string; roles?: RoleTag[] };

export function queuePendingRefs(refs: PendingRef[]) {
  if (typeof window === "undefined" || refs.length === 0) return;
  window.sessionStorage.setItem(KEY, JSON.stringify(refs));
}

export function consumePendingRefs(): PendingRef[] {
  if (typeof window === "undefined") return [];
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return [];
  window.sessionStorage.removeItem(KEY);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingRef[]) : [];
  } catch {
    return [];
  }
}
