# MarkLens 릴리즈 안전 장치 (R-2)

Preview 검증과 Production 출시를 사고 없이 진행하기 위한 기준 문서다.

- 실행 절차: [preview-runbook.md](preview-runbook.md)
- 개인정보·구독 준비: [privacy-subscription.md](privacy-subscription.md)
- 도구: `scripts/release/preflight-env.mjs`(환경 변수 점검), `scripts/release/check-production-schema.sql`(읽기 전용 스키마 점검)

## 1. 환경 구분과 차단 정책

`src/lib/release/guard.mjs`가 배포 환경을 판정한다.

| 판정 | 조건 | 동작 |
|---|---|---|
| production | `VERCEL_ENV=production` | 기존 동작 그대로 |
| preview | `VERCEL_ENV`가 production이 아닌 Vercel 배포 전부(`preview`, `development`, 값 없음 + `VERCEL=1`), 또는 `MARKLENS_DEPLOYMENT=preview` | 아래 표처럼 차단 |
| local | 위 어느 것도 아님(`next dev`, `next start`) | 기존 동작 그대로 |

Preview에서의 동작:

| 작업 | 허용 조건 | 차단 위치 |
|---|---|---|
| DB 쓰기(insert/update/upsert/delete, 쓰기 RPC, Storage 변경) | `NEXT_PUBLIC_SUPABASE_URL`이 `<ref>.supabase.co`이고 그 ref가 운영 프로젝트가 아닐 때만 | Supabase 서버 클라이언트 3종(`admin`, `server`, `public`) |
| Instagram / Threads 게시·토큰 갱신 | 항상 차단 | `lib/instagram.ts`, `lib/threads.ts` + egress |
| 이메일(Brevo) | 항상 차단 | 구독·확인·드립·뉴스레터·관리자 알림 + egress |
| AWS(Lambda 렌더, S3 삭제) | 항상 차단 | `shorts/render`, `shorts/download`, `shorts/reels` |
| Cron | 항상 차단(403) | 크론 5종(인증 확인 직후) |
| 유료 AI | `PREVIEW_ALLOW_AI=true`일 때만(일일 한도는 계속 적용) | `src/instrumentation.ts` egress |

- 운영 프로젝트 ref는 `PRODUCTION_SUPABASE_REFS`(공개 프로젝트 id)와 `MARKLENS_PRODUCTION_SUPABASE_REFS`(쉼표 구분)로 판단한다. 판단할 수 없는 주소(사용자 지정 도메인, 값 없음)는 운영으로 간주해 막는다.
- 읽기(공개 페이지, 관리자 조회), 로그인(Supabase Auth), 읽기 전용 RPC(`random_quiz`)는 허용한다.
- `/api/admin/health`의 `release` 항목에서 판정 결과(배포 종류, DB ref, 격리 여부, 차단 목록)를 이름만 확인할 수 있다.
- **전제:** Vercel의 시스템 환경 변수(`VERCEL_ENV`, `VERCEL`)가 런타임에 노출돼 있어야 한다(Vercel 기본값). 노출이 꺼져 있으면 Preview가 local로 판정돼 보호가 꺼진다. Preview 첫 배포 후 health의 `release.deployment`가 `preview`인지 반드시 확인한다.

## 2. 외부 서비스 감사

| 서비스 | 쓰는 곳 | 중복·실패 처리 | Preview | 로컬 검증 | 실연동 검증 |
|---|---|---|---|---|---|
| Instagram | 카드뉴스 발행(수동·예약), 릴스, 토큰 갱신, 지표 조회 | 채널별 선점(023), 게시 전 실패→재시도 가능, 게시 중·후 실패→확인 필요 | 게시·갱신 차단, 지표 조회(GET) 허용 | 단위·동시성 테스트 | 미검증 |
| Threads | IG 성공 후 교차 발행, 수동 재시도 | 채널별 상태 독립 | 차단 | 단위 테스트 | 미검증 |
| Brevo | 구독 확인·환영·드립·뉴스레터·관리자 알림 | 뉴스레터 발송 전 호 선점(409) | 차단 | 단위 테스트, 오류 응답 매핑 | 미검증 |
| AI (Gemini → Claude → OpenAI 폴백) | 수집 분석, 카드뉴스·뉴스레터 생성, 챗, 면접, 퀴즈, Insight Lab | 공개 AI 8개 경로에 일일 한도(024), 요청당 출력 토큰 상한 | 기본 차단 | 단위 테스트, 한도 SQL(PGlite) | 미검증(유료) |
| AWS / Remotion | 릴스 렌더(Lambda), 결과 S3 삭제 | 렌더 실패는 오류 응답 | 차단 | 로컬 렌더러로 MP4 생성 확인(R-1) | 미검증(유료) |
| Supabase | 전체 데이터, Auth, Storage | RLS(공개 읽기 정책), service_role 서버 전용 | 격리 증명 시에만 쓰기 | 목업·PGlite | 운영 DB 상태 미확인 |

남은 위험:
- 관리자·크론 경로의 AI 호출(수집, 생성)은 일일 한도 대상이 아니다. 인증(관리자·시크릿)이 유일한 통제다.
- 전역 **동시** AI 호출 수 제한은 없다. 일일 한도와 분당 제한으로 폭주 규모만 제한한다.
- 서비스 키가 Preview 환경 변수에 남아 있으면 코드 밖(예: 수동 스크립트)에서는 보호되지 않는다. Preview에는 운영 자격 증명을 두지 않는다.
