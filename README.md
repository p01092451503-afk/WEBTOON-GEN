# PilotToon

Studio 0103 Seedream Generator — SaaS 재개발 Lovable 프롬프트 패키지

대상: Studio 0103 Seedream Generator V21.7 STABLE (Electron 설치형) → 멀티테넌트 SaaS 스택: React + Vite + Supabase (Auth / Postgres+RLS / Storage / Edge Functions) 사용법: 아래 P0~P8 을 순서대로 하나씩 Lovable 에 붙여넣는다. 한 번에 몰아넣지 말 것. 핵심 자산인 프롬프트 엔진(§4)은 "재작성"이 아니라 "그대로 이식"한다.

Studio 0103 Seedream Generator 의 이름을 toonpilot으로 명칭을 변경(이후 모두 toopilot 으로 지칭할 것)

첨부한 파일도 분석을 하여 대응 / 가장 효율적이고, 첨부된 파일보다 발전된 SaaS 방향을 지향해야해!


P0. 절대 규칙 (첫 프롬프트로 반드시 먼저 주입)

너는 웹툰 캐릭터 이미지 생성 SaaS 를 만든다. 아래 규칙은 프로젝트 전체에서 절대 위반 금지다.




1. BytePlus Seedream(ARK) API 키는 클라이언트 코드/번들/네트워크 응답 어디에도 절대 노출 금지.




   - 모든 Seedream 호출은 Supabase Edge Function 안에서만 실행한다.




   - 키는 Supabase 시크릿(ARK_API_KEY, ARK_ENDPOINT_ID, ARK_BASE_URL)으로만 읽는다.




   - 클라이언트가 ARK 엔드포인트로 직접 fetch 하는 코드는 만들지 마라.




2. 모든 테이블에 RLS 를 켜고, 로그인 사용자의 tenant 범위로만 접근을 허용한다.




3. 캐릭터 레퍼런스/결과 이미지는 비공개 Storage 버킷에만 저장하고,




   클라이언트에는 짧은 TTL 의 서명 URL(signed URL)만 발급한다. public URL 금지.




4. 이미지 데이터를 base64 로 JSON body 에 실어 보내지 않는다.




   업로드는 서명 URL 로 스토리지에 직접 올리고, 생성 요청에는 storage path 만 넘긴다.




5. 원본 파일시스템 경로를 사용자 입력으로 조립하지 않는다(설치형의 방식). storage key 로만 다룬다.




먼저 이 규칙을 확인했다고 답하고, 아직 코드는 만들지 마라. 다음 프롬프트를 기다려라.








P1. 제품 개요 컨텍스트

[제품]




웹툰/캐릭터 이미지 생성 SaaS. 사용자가 캐릭터 레퍼런스 시트(얼굴·의상·체형)를 등록하고,




포즈·배경·카메라·감정 프리셋을 조합해 "캐릭터 정체성은 고정하고 포즈/배경/카메라만 바꾼"




일관된 웹툰 컷을 대량 생성한다.




[핵심 개념 — 그대로 유지]




- 각 레퍼런스 이미지는 Figure 1, Figure 2 … 번호가 부여된다.




- 순서 규칙: Character A → Character B → Background → Pose (Pose 는 항상 마지막).




- 최종 프롬프트는 "Character A/B" 같은 UI 라벨이 아니라 전부 "Figure N" 어휘로 정규화되어야 한다.




- 프롬프트는 금지문("Never/Do not/Avoid") 없이 행동형 지시문(Keep/Replace/Replicate/Maintain)으로,




  80~150 단어 목표.




[MVP 범위 — 포함]




인증·테넌트, 캐릭터 레퍼런스 라이브러리, 프롬프트 엔진 이식, 생성(동기 허용) + 스토리지 저장, 히스토리 DB화.




[MVP 범위 — 제외(2단계)]




비동기 큐 전면 전환, 크레딧·결제, 콘텐츠 모더레이션, 협업 공유. (단, 인터페이스는 2단계 전환 전제로 설계)




확인만 하고 대기하라.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a84a073c-c52d-4207-b61c-3cda88722de8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
