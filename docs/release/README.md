# MarkLens 릴리즈 안전 장치 (R-2, R-3)

Preview 검증과 Production 출시를 사고 없이 진행하기 위한 기준 문서다.

- 실행 절차: [preview-runbook.md](preview-runbook.md)
- Production 출시 계획(승인용): [production-rollout.md](production-rollout.md)
- 개인정보·구독 준비: [privacy-subscription.md](privacy-subscription.md), 초안: [privacy-policy-draft.md](privacy-policy-draft.md)
- 도구:

| 도구 | 용도 | 대상 DB 접속 |
|---|---|---|
| `npm run release:preflight` (`scripts/release/preflight.mjs`) | 배포 전 단일 게이트: git·환경 변수·차단 시뮬레이션·스키마·AI 준비·tsc·eslint·테스트·빌드. PASS / FAIL / UNKNOWN | 없음(파일 입력) |
| `scripts/release/preflight-env.mjs` | 환경 변수 파일만 점검(게이트의 env 항목과 같은 규칙) | 없음 |
| `scripts/release/check-production-schema.sql` | 마이그레이션 001–024 적용 여부. SELECT 1개 | 읽기 전용 |
| `scripts/release/describe-unmanaged-schema.sql` | 저장소 밖에서 만들어진 테이블의 실제 정의(컬럼·제약·인덱스·트리거·RLS·정책·권한·함수·의존 객체·버킷). SELECT 1개, 결과 1개 | 읽기 전용 |
| `scripts/release/compare-unmanaged-schema.mjs` | 위 결과 CSV를 Preview 번들(PGlite)의 같은 조회와 비교. 항목마다 만든 파일을 추적해 "001a 추론 오류"와 "운영에 아직 없는 마이그레이션"을 구분 | 없음(CSV 입력) |
| `scripts/release/build-preview-sql.mjs` | 빈 Preview DB 하나를 만드는 SQL 번들(001 → 001a → 002…024 → 합성 시드 → 운영 일치 → 점검 결과). `public`에 테이블이 있으면 첫 문장에서 중단 | 없음(stdout 출력) |
| `scripts/release/production-readiness.sql` | 운영 적용 직전 건수·평균 행 크기·Insight Lab 권한·자동 발행 플래그. SELECT 1개, 행 내용·개인정보 없음 | 읽기 전용 |
| `scripts/release/seed-preview-posters.mjs` | Preview 버킷 `stock-posters`에 합성 포스터(운영 이미지 복제 아님). 기본 dry run, `--apply`일 때만 업로드, 운영·증명 불가 주소 거부 | Preview만 |
| `scripts/release/verify-preview-db.mjs` | env 파일의 Supabase가 초기화된 Preview DB인지 확인(표식·마이그레이션·시드·권한·버킷·관리자). 운영·증명 불가 주소엔 요청 0 | Preview만, GET 전용 |

## 1. 환경 구분과 차단 정책

`src/lib/release/guard.mjs`가 배포 환경을 판정한다.

| 판정 | 조건 | 동작 |
|---|---|---|
| preview | `MARKLENS_DEPLOYMENT=preview`, 또는 `VERCEL_ENV`가 production이 아닌 Vercel 배포 전부(`preview`, `development`, 값 없음 + `VERCEL=1`), 또는 `VERCEL_ENV=production`인데 `VERCEL_TARGET_ENV`가 production이 아닐 때(신호 충돌 → 안전한 쪽) | 아래 표처럼 차단 |
| production | `VERCEL_ENV=production`(위 예외 제외) | 기존 동작 그대로 |
| local | 위 어느 것도 아님(`next dev`, `next start`) | 기존 동작 그대로 |

**R-3:** Preview 환경 변수에는 `MARKLENS_DEPLOYMENT=preview`를 **Preview 범위로만** 넣는다. 이렇게 하면 Vercel 시스템 변수(`VERCEL_ENV`)가 런타임에 노출되지 않아도 보호가 켜진다. Production 범위에 이 값이 있으면 운영 기능이 모두 멈춘다. 게이트가 양쪽을 모두 FAIL로 잡는다.

### Preview에서의 동작

| 작업 | 허용 조건 | 차단 위치 |
|---|---|---|
| **DB 전체**(읽기·쓰기·RPC·Storage·Auth) | DB 격리를 증명할 수 있을 때만: `<ref>.supabase.co`이고 ref가 운영 프로젝트가 아님, 또는 loopback 주소(로컬 QA) | 서버 클라이언트(`admin`, `server`)의 `guardDatabase`; 브라우저 클라이언트(`lib/supabase/client.ts`)는 빌드 시점 판정 `MARKLENS_BROWSER_DB_BLOCKED`(next.config.ts) |
| 관리자 영역(`/admin`, `/api/admin`) | DB 격리 증명 시에만. 아니면 세션 확인 전에 503 | `src/proxy.ts` |
| Instagram / Threads 게시·토큰 갱신 | 항상 차단 | `lib/instagram.ts`, `lib/threads.ts` + egress |
| 이메일(Brevo) | 항상 차단 | 구독·확인·드립·뉴스레터·관리자 알림 + egress |
| AWS(Lambda 렌더, S3 삭제) | 항상 차단 | `shorts/render`, `shorts/download`, `shorts/reels` |
| Cron | 항상 차단(403) | 크론 5종(인증 확인 직후) |
| 유료 AI | `PREVIEW_ALLOW_AI=true`일 때만(일일 한도는 계속 적용) | `src/instrumentation.ts` egress |

- 격리를 증명하지 못하면(운영 ref, 사용자 지정 도메인, 값 없음) DB를 **읽지도** 않는다. 공개 페이지는 빈 목록으로 뜨고, 구독·피드백은 오류로 끝나며, 로그인은 실패한다. 운영 구독자·세션·관리자 데이터가 Preview로 흘러가지 않게 하기 위해서다(R-2는 쓰기만 막았다).
- 운영 프로젝트 ref는 `PRODUCTION_SUPABASE_REFS`(공개 프로젝트 id)와 `MARKLENS_PRODUCTION_SUPABASE_REFS`(쉼표 구분)로 판단한다.
- `/api/admin/health`의 `release` 항목에서 판정 결과(배포 종류, DB ref, 격리 여부, 차단 목록)를 이름만 확인할 수 있다.

### AI 비상 정지와 한도

- `AI_KILL_SWITCH=on`: **모든 배포**(Production 포함)에서 유료 AI 호출을 멈춘다. 공개 AI 경로는 한도를 읽기 전에 503, 관리자·크론의 AI 호출은 egress에서 거부된다. 다른 기능(DB, 메일, 게시)은 그대로다. 해제는 값을 지우고 재배포한다.
- 공개 AI 8개 경로는 호출 전에 `consume_ai_quota`(024)로 기능·사용자별 일일 한도와 전체 일일 한도를 확인한다. **한도를 셀 수 없으면(024 미적용, 권한 오류, DB 장애) 503으로 막는다(fail-closed).** 따라서 024는 이 코드를 배포하기 전의 필수 조건이다.
- 한도 조정: `AI_DAILY_LIMITS="chat=100,interview=60,learn=200,insight-lab=20,global=3000"`(생략 시 이 기본값).

## 2. 환경 변수 매트릭스

값은 이 문서·보고서·커밋에 적지 않는다. "Preview 금지"는 코드가 차단하더라도 넣지 않는다는 뜻이다(코드 밖 스크립트·실수 대비).

| 변수 | Production | Preview | 비고 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 필수(운영 프로젝트) | 필수(**Preview 전용 프로젝트**) | Preview에서 운영 ref면 게이트 FAIL, 앱은 DB 전체 차단 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 필수 | 필수(Preview 프로젝트 키) | |
| `SUPABASE_SERVICE_ROLE_KEY` | 필수 | 필수(Preview 프로젝트 키) | 운영 키를 Preview에 넣지 않는다 |
| `NEXT_PUBLIC_SITE_URL` | 필수 `https://marklens.site` | 필수(Preview URL) | Preview가 운영 도메인을 가리키면 FAIL |
| `ADMIN_EMAIL` | 필수 | 필수(Preview Auth에 만든 테스트 관리자) | 비어 있으면 관리자 전부 거부 |
| `CRON_SECRET` | 필수 | 필수(Preview 전용 값) | 비어 있으면 크론 전부 401 |
| `N8N_WEBHOOK_SECRET` | 필수 | 필수(Preview 전용 값) | |
| `MARKLENS_DEPLOYMENT` | **금지** | **필수 `preview`** | R-3 |
| `PREVIEW_ALLOW_AI` | 금지(의미 없음) | 선택 — 기본 미설정 | `true`면 Preview에서 유료 AI 허용(한도 적용) |
| `AI_KILL_SWITCH` | 비상시에만 `on` | 선택 | |
| `AI_DAILY_LIMITS` | 선택 | 선택(낮게 권장) | |
| `MARKLENS_PRODUCTION_SUPABASE_REFS` | 선택 | 선택 | 운영 ref 추가 목록 |
| `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | 필수(Gemini), 폴백 선택 | 미설정 권장 — `PREVIEW_ALLOW_AI=true`일 때만 별도 저한도 키 | |
| `BREVO_API_KEY` | 필수 | **금지** | 코드도 차단 |
| `IG_ACCESS_TOKEN`, `IG_USER_ID`, `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID` | 필수 | **금지** | 코드도 차단 |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `REMOTION_FUNCTION_NAME`, `REMOTION_SERVE_URL` | 필요 시 | **금지** | 코드도 차단 |
| `GA4_PROPERTY_ID`, `GA4_SA_CLIENT_EMAIL`, `GA4_SA_PRIVATE_KEY` | 선택(관리자 지표) | **금지** | 운영 분석 데이터 |
| `NEXT_PUBLIC_GA_ID` | 선택(기본값 있음) | 미설정 | GA는 production 판정이면서 `marklens.site`일 때만 동작 |
| `YOUTUBE_API_KEY`, `UNSPLASH_ACCESS_KEY` | 선택 | 미설정 권장(읽기 API, 쿼터 공유) | |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_TARGET_ENV` | Vercel이 설정 | Vercel이 설정 | 직접 넣지 않는다 |

`.env.local`에만 있고 코드가 쓰지 않는 값(`SHOTSTACK_API_KEY`, `APIFY_API_TOKEN`, `PEXELS_API_KEY`, `FISH_AUDIO_API_KEY`, `IG_APP_SECRET`, `AWS_REGION`)은 Preview에 넣지 않는다.

## 3. 외부 서비스 감사

| 서비스 | 쓰는 곳 | 중복·실패 처리 | Preview | 로컬 검증 | 실연동 검증 |
|---|---|---|---|---|---|
| Instagram | 카드뉴스 발행(수동·예약), 릴스, 토큰 갱신, 지표 조회 | 채널별 선점(023), 게시 전 실패→재시도 가능, 게시 중·후 실패→확인 필요 | 게시·갱신 차단, 지표 조회(GET) 허용 | 단위·동시성 테스트, 실빌드 크론 403 | 미검증 |
| Threads | IG 성공 후 교차 발행, 수동 재시도 | 채널별 상태 독립 | 차단 | 단위 테스트 | 미검증 |
| Brevo | 구독 확인·환영·드립·뉴스레터·관리자 알림 | 뉴스레터 발송 전 호 선점(409) | 차단 | 단위 테스트, 오류 응답 매핑 | 미검증 |
| AI (Gemini → Claude → OpenAI 폴백) | 수집 분석, 카드뉴스·뉴스레터 생성, 챗, 면접, 퀴즈, Insight Lab | 공개 AI 8개 경로에 일일 한도(024, fail-closed), 요청당 출력 토큰 상한, `AI_KILL_SWITCH` | 기본 차단 | 단위 테스트, 한도 SQL(PGlite), 실빌드 503 | 미검증(유료) |
| AWS / Remotion | 릴스 렌더(Lambda), 결과 S3 삭제 | 렌더 실패는 오류 응답 | 차단 | 로컬 렌더러로 MP4 생성 확인(R-1) | 미검증(유료) |
| Supabase | 전체 데이터, Auth, Storage | RLS(공개 읽기 정책), service_role 서버 전용 | 격리 증명 시에만 접근 | 목업·PGlite, Preview 번들 PGlite 재현 | 운영 DB 상태 미확인 |

관리자·크론 AI 배치 상한(코드 기준): 수집 분석 호출당 3건, 퀴즈 대량 생성 30문항, 학습 시드 최대 6회(조합당 50 이하), 수집(RSS)은 AI 없음, 카드뉴스 생성은 기사 1건 단위.

남은 위험:
- 관리자·크론 경로의 AI 호출은 일일 한도 대상이 아니다. 인증(관리자·시크릿)과 위 배치 상한, `AI_KILL_SWITCH`가 통제 수단이다.
- 전역 **동시** AI 호출 수 제한(리스)은 없다. 일일 한도와 분당 제한으로 폭주 규모만 제한한다.
- 서비스 키가 Preview 환경 변수에 남아 있으면 코드 밖(예: 수동 스크립트)에서는 보호되지 않는다. Preview에는 운영 자격 증명을 두지 않는다.
- 격리된 Preview에서 Insight Lab 이메일 로그인(매직 링크)은 Preview Supabase Auth의 메일 발송기를 쓴다. 입력한 주소로만 가며 운영 Brevo와 무관하다.
