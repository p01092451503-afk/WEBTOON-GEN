// src/lib/studioRefs.ts
// 레퍼런스 이미지(역할 태그) → 기존 프롬프트 엔진 figureMap 어댑터.
// 엔진(buildFigureMap)의 Figure N 순서/정규화는 그대로 재사용한다. 재구현 금지.

import { buildFigureMap, type Figure } from "@/lib/promptEngine";

export const MAX_REFS = 10;

export type RoleTag =
  | "character"
  | "background"
  | "costume"
  | "pose"
  | "composition"
  | "style"
  | "prop"
  | "etc";

export const ROLE_TAGS: RoleTag[] = [
  "character",
  "background",
  "costume",
  "pose",
  "composition",
  "style",
  "prop",
  "etc",
];

/** 별도 Figure 없이 프롬프트 컨텍스트로만 편입되는 역할 */
export const CONTEXT_ONLY_ROLES: RoleTag[] = ["costume", "prop", "etc"];

export type StudioRef = {
  id: string;
  /** storage path (character-refs 버킷). base64 사용 금지 */
  path: string;
  roles: RoleTag[];
  /** 이미지 그룹에서 가져온 경우 원본 캐릭터명 */
  sourceName?: string;
};

export function mentionOf(refs: StudioRef[], id: string): string {
  const i = refs.findIndex((r) => r.id === id);
  return i < 0 ? "" : `@image${i + 1}`;
}

export type StudioFigureResult = {
  figureMap: Figure[];
  /** figureMap 순서와 1:1 로 대응하는 storage path 배열 */
  imagePaths: string[];
  /** 별도 Figure 없이 프롬프트 컨텍스트로만 쓰이는 레퍼런스 */
  contextRefs: StudioRef[];
};

/**
 * 역할 태그 → figureMap 어댑터
 * - 카메라 캐릭터 A/B 지정  → charA / charB
 * - 역할 "배경"            → bg
 * - 역할 "포즈" 또는 "구도" → pose (마지막 것)
 * - 역할 "스타일"          → style
 * - 의상/소품/기타         → Figure 없음 (컨텍스트)
 */
export function buildStudioFigures(opts: {
  refs: StudioRef[];
  charARefId: string | null;
  charBRefId: string | null;
  charAName?: string;
  charBName?: string;
}): StudioFigureResult {
  const { refs, charARefId, charBRefId } = opts;
  const byId = (id: string | null) => (id ? refs.find((r) => r.id === id) ?? null : null);

  const charA = byId(charARefId);
  const charB = byId(charBRefId);

  const isTaken = (r: StudioRef) => r.id === charA?.id || r.id === charB?.id;

  const bg = refs.find((r) => !isTaken(r) && r.roles.includes("background")) ?? null;
  const poseCandidates = refs.filter(
    (r) => !isTaken(r) && r.id !== bg?.id && (r.roles.includes("pose") || r.roles.includes("composition")),
  );
  const pose = poseCandidates.length ? poseCandidates[poseCandidates.length - 1] : null;
  const style =
    refs.find((r) => !isTaken(r) && r.id !== bg?.id && r.id !== pose?.id && r.roles.includes("style")) ?? null;

  const figureMap = buildFigureMap({
    hasCharA: !!charA,
    hasCharB: !!charB,
    hasBg: !!bg,
    hasPose: !!pose,
    hasStyle: !!style,
    charAName: opts.charAName || charA?.sourceName || "",
    charBName: opts.charBName || charB?.sourceName || "",
  });

  const imagePaths = [charA, charB, bg, pose, style]
    .filter((r): r is StudioRef => !!r)
    .map((r) => r.path);

  const used = new Set([charA?.id, charB?.id, bg?.id, pose?.id, style?.id].filter(Boolean) as string[]);
  const contextRefs = refs.filter((r) => !used.has(r.id));

  return { figureMap, imagePaths, contextRefs };
}

/** 이미지 1장당 예상 크레딧 — 단일 소스는 @/lib/credits */
export { CR_PER_IMAGE } from "@/lib/credits";
