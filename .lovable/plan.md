# 다국어 (i18n) 기능 추가 플랜

플랫폼 기본은 영어(en)를 유지하고, 사용자가 상단 헤더에서 한국어(ko)로 전환할 수 있게 합니다. 선택한 언어는 브라우저에 저장되어 다음 접속에도 유지됩니다.

## 사용자 경험

- 상단 앱바 우측(알림 아이콘 옆)에 언어 전환 버튼 추가 → `EN / KO` 토글.
- 새로고침 후에도 선택한 언어 유지 (localStorage).
- 로그인/랜딩 페이지에서도 동일하게 동작.
- 초기 로드 시 저장된 값이 없으면 브라우저 언어 자동 감지, 실패 시 영어.

## 번역 범위 (1차)

- 공통: 사이드바 메뉴, 앱바 타이틀/검색 placeholder, 로그아웃 등
- 페이지: Landing, Login, Projects, Project detail, Episodes(스토리보드), Characters, Studio(generate 4패널 컨트롤 라벨), History, Settings
- 상태/토스트 메시지: 성공/실패 알림, 빈 상태 안내 문구
- 프리셋 옵션명(카메라/포즈/감정 등)은 DB `label_en` 컬럼 유지 — 이번 범위 밖 (2차 확장 여지)

## 기술 세부

- 패키지: `i18next`, `react-i18next`, `i18next-browser-languagedetector` 추가.
- 구조:
  ```text
  src/i18n/
    index.ts           # i18n init (en 기본, localStorage 감지)
    locales/en.json    # 영어 리소스 (네임스페이스: common, sidebar, auth, projects, episodes, characters, studio, history)
    locales/ko.json    # 한국어 리소스 (동일 키 대응)
  ```
- `src/router.tsx` 또는 `__root.tsx`에서 i18n 초기화 임포트.
- 컴포넌트에서 `const { t } = useTranslation("네임스페이스")` 사용.
- 언어 전환 컴포넌트 `src/components/language-toggle.tsx` 신설 → 앱바에 배치.
- SSR 안전: 초기 언어는 `en`으로 시작, 하이드레이션 후 저장값 반영 (hydration mismatch 방지).

## 작업 순서

1. 패키지 설치 및 `src/i18n/index.ts` + `en.json`/`ko.json` 생성 (전체 문자열 카탈로그화).
2. `__root.tsx`에 i18n import.
3. `LanguageToggle` 컴포넌트 추가 → `app-header.tsx`에 삽입.
4. 하드코딩된 영문 문자열을 `t("...")` 로 치환:
   - `app-sidebar.tsx`, `app-header.tsx`
   - `routes/index.tsx` (랜딩), `routes/auth.tsx` (로그인)
   - `_authenticated/projects.index.tsx`, `projects.$id.tsx`
   - `_authenticated/episodes.$id.tsx`
   - `_authenticated/characters.tsx`
   - `_authenticated/generate.tsx` (섹션/라벨/버튼)
   - `_authenticated/history.tsx`
5. 빌드 확인 및 EN↔KO 토글 동작 검증.

## 범위 제외

- 프리셋 아이템 라벨(auto, smile 등) 다국어화 — DB 스키마 확장 필요.
- 이메일/서버 응답 메시지 다국어화.
- URL 경로 다국어화(`/ko/...`).

승인 시 위 순서대로 구현하겠습니다.