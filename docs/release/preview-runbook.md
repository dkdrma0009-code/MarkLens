# Preview → Production 실행 계획 (R-2, R-3)

R-3 시점: 로컬에서 할 수 있는 준비와 검증은 끝났다. 남은 것은 클라우드 작업(Preview DB 생성, 환경 변수, Push, Preview 배포)이며 모두 **승인 후** 실행한다. 각 단계의 **게이트**를 통과하지 못하면 다음 단계로 가지 않는다. 게이트 판정은 `npm run release:preflight`가 한 번에 낸다(UNKNOWN은 통과가 아니다).

## 0. 리소스 현황

| 리소스 | 상태 | 근거 |
|---|---|---|
| Vercel 프로젝트 | 있음(메인 체크아웃이 연결됨). 설정(시스템 변수 노출 등)은 로컬에서 확인 불가 | `.vercel/project.json`, Vercel CLI 미설치 |
| 운영 Supabase(`ndeh…`) | 있음. **001–016 적용, 017–024 미적용**(2026-10-24 읽기 전용 확인) | `check-production-schema.sql` 결과 |
| **Preview 전용 Supabase 프로젝트** | **없음 — 새로 필요** | — |
| Preview DB 초기화 SQL | 준비됨: `node scripts/release/build-preview-sql.mjs` — 저장소 밖 객체가 **운영과 일치**(`compare-unmanaged-schema.mjs`: 023 미적용분 외 차이 0) | PGlite에서 빈 DB → 전체 적용 → 스키마 점검 통과(`tests/preview-db.test.mjs`) |
| Preview 전용 IG·Threads·Brevo·AWS | 불필요 — Preview에서는 코드로 차단 | `docs/release/README.md` 1장 |

### 운영에서 만들어진, 저장소에 정의가 없는 객체

`app_config`, `cardnews`, `feedback`, `follower_snapshots`, `quiz_questions`, `site_feedback`, `competitions`, `insights`의 `hook`·`marketing_terms`·`quiz`·`video_url` 컬럼, `random_quiz()` 함수. 마이그레이션 001–024만으로는 빈 DB가 만들어지지 않는다(006이 이 테이블들에 권한을 준다).

- `supabase/preview/001a_unmanaged_tables.sql`이 이 객체들을 정의한다(Preview·로컬 전용, 운영에 적용 금지). 처음에는 코드에서 추론했고, R-3 B(2026-10-24)에서 운영 정의를 읽어 **컬럼·타입·NULL 여부·기본값·키·CHECK·인덱스·RLS·정책·함수**를 운영과 같게 맞췄다.
- 운영에서 이미 사라진 것(`competitions` 테이블)과 저장소가 재현할 수 없는 권한 상태(`random_quiz` 실행 권한), 운영의 Storage 버킷 4개는 `supabase/preview/950_production_parity.sql`이 마지막에 맞춘다.
- 운영 스키마가 바뀌면 3단계를 다시 실행해 비교한다.

## 1–6. 준비

1. **복구 지점 기록** — 현재 Production 배포 id와 `origin/master` 커밋을 기록한다(Vercel 대시보드). 롤백 대상이다.
2. **Git** — `release/brand-watch-v1`이 `origin/master`를 모두 포함하고 작업 트리가 깨끗해야 한다(게이트 `[git]`).
3. **운영 스키마 확인(읽기 전용, B 승인됨)** — 두 파일 모두 시스템 카탈로그만 읽는 SELECT 1개다. 데이터 행, 쓰기, 설정 변경은 없고 정책식의 문자열은 `'…'`로 가려진다.
   1. Supabase 대시보드 → **운영 프로젝트** → SQL Editor → New query.
   2. 결과 행 수 제한을 끈다(또는 가장 큰 값). 잘린 다운로드는 비교 도구가 거부한다(마지막 `99 end` 행이 행 수를 담는다).
   3. `scripts/release/check-production-schema.sql` 전체를 붙여 넣고 Run → 결과 Export/Download CSV → `production-schema.csv`(23행).
   4. 새 쿼리에 `scripts/release/describe-unmanaged-schema.sql` 전체를 붙여 넣고 Run → Download CSV → `production-describe.csv`.
   5. 비교(로컬):
      ```
      PGLITE_MODULE=<@electric-sql/pglite 경로> node scripts/release/compare-unmanaged-schema.mjs production-describe.csv production-schema.csv
      ```
      객체별 MATCH / MISMATCH. 운영에 아직 없는 저장소 마이그레이션(예: 023) 항목은 불일치가 아니라 "NOT APPLIED"로 따로 표시된다. 불일치가 있으면 `supabase/preview/001a_unmanaged_tables.sql`을 운영 정의에 맞추고 `tests/preview-db.test.mjs`를 다시 돌린다.
4. **Preview DB 만들기(승인 필요)**
   1. 새 Supabase 프로젝트를 만든다. 운영과 같은 리전을 권장한다. 비용(2026-10 Supabase 문서 기준, 생성 전 대시보드에서 재확인):
      - Free 조직: Owner/Admin인 모든 조직을 합쳐 활성 무료 프로젝트 2개까지 무료. 1주일 비활성 시 일시 정지.
      - Pro 조직: 월 $25에 포함된 컴퓨트 크레딧 $10은 프로젝트 1개분이다. 추가 프로젝트는 Micro 기준 약 $10/월이고 시간 단위로 과금된다. 컴퓨트는 지출 상한(Spend Cap) 대상이 아니다. 일시 정지하거나 삭제하면 과금이 멈춘다.
   2. `node scripts/release/build-preview-sql.mjs > preview-init.sql` → Preview 프로젝트 SQL Editor에서 한 번 실행한다.
      - `public` 스키마에 테이블이 하나라도 있으면(운영, 이미 초기화된 Preview) 첫 문장에서 멈추고 아무것도 바꾸지 않는다.
      - 마지막 결과는 읽기 전용 마이그레이션 점검(23행)이며 모두 `true`여야 한다. 이 결과를 `preview-schema.csv`로 내려받는다.
      - 운영 데이터는 복사하지 않는다. 시드는 합성 기사 3건·퀴즈 2건(`example.test`), 자동 발행 꺼짐 설정, Preview 표식(`app_config.marklens_environment = preview`)뿐이다.
   3. Storage: 번들이 운영과 같은 public 버킷 4개(`ad-assets`, `ad-clips`, `cardnews-ig`, `stock-posters`)를 만든다. Storage 화면에서 생성됐는지만 확인한다.
   4. Auth: 테스트 관리자 사용자 1명을 만들고(이 주소가 Preview `ADMIN_EMAIL`), URL 설정의 Site URL·Redirect URL에 Preview 주소와 `/auth/callback`을 넣는다.
   5. 프로젝트 URL·anon·service_role 키와 `ADMIN_EMAIL`을 작업 폴더의 `.env.preview.local`(Git 제외)에 넣고 `node scripts/release/verify-preview-db.mjs .env.preview.local`로 확인한다. 이 도구는 운영이거나 증명할 수 없는 주소면 요청을 하나도 보내지 않고 멈추며, Preview 표식·마이그레이션 객체·시드 건수·anon 권한·버킷·관리자 계정을 GET 요청으로만 확인한다.
   - **게이트:** Preview 프로젝트 ref ≠ 운영 ref, 번들 마지막 결과가 모두 `true`, `verify-preview-db.mjs` FAIL 0.
5. **Preview 환경 변수(승인 필요)** — 매트릭스(`README.md` 2장)대로 **이 브랜치의 Preview 범위에만**(target preview + gitBranch) 넣는다. `MARKLENS_DEPLOYMENT=preview` 필수.
   - Vercel은 원격에 있는 브랜치에만 브랜치 범위 변수를 허용한다. 그래서 브랜치를 먼저 올리되, `vercel.json`의 `git.deploymentEnabled`로 **이 브랜치만 자동 배포를 보류**한 커밋을 올린다(빌드 자체가 생기지 않음을 확인).
   - 모든 Preview가 물려받는 운영 자격 증명(AWS, Remotion, GA4, Shotstack, Unsplash 등)은 운영 값을 건드리지 않고, 이 브랜치 범위에 같은 이름의 무효값 `disabled-in-preview`를 넣어 가린다(게이트는 이 값을 "없음"으로 본다).
   - `ADMIN_PASSWORD`는 로컬 검증용이며 Vercel에 넣지 않는다(앱 코드가 쓰지 않는다).
6. **게이트 실행** — 이 브랜치가 실제로 받는 값(브랜치 값이 일반 Preview 값을 덮어쓴 결과)을 내려받아 돌린다.
   ```
   npm run release:preflight -- --target preview --env <내려받은 env> --schema preview-schema.csv --run-tests --run-build
   ```
   - PASS여야 다음 단계로 간다. `HEAD pushed`, `contains origin/master`의 WARN은 Preview에서는 허용된다.
   - `--run-build`는 현재 셸의 환경으로 빌드한다. Preview 값을 셸에 불러온 뒤 실행한다(빌드는 Preview DB만 읽는다). 단위 테스트는 배포 판정 변수를 뺀 중립 환경에서 돈다.
   - PASS면 보류를 푸는 커밋을 올려 첫 Preview를 만든다.

## 7–11. Preview 배포·검증 (승인 후)

7. `git push origin release/brand-watch-v1` → Vercel이 Preview를 만든다(Production 무영향 — Production은 `master`만 배포).
8. **첫 확인:** Preview 관리자로 로그인한 뒤 `/api/admin/health`를 연다.
   - `release.deployment = "preview"`, `databaseIsolated = true`, `blocked`에 instagram·threads·email·aws·cron(·ai) 포함.
   - 아니면 즉시 중단한다(아래 "중단").
9. **사용자 여정 스모크:**
   - 홈 → Hero → 상세(합성 기사) → 관련 글 → `/insights` 목록 → Brand Watch → Weekly 구독 1건. 구독은 Preview DB에 저장되고 "확인 메일" 발송은 차단되는 것이 정상이다.
   - 404·빈 화면·콘솔 오류가 없어야 한다.
10. **관리자·제작 흐름:** 기사 검수 → 발행 → 공개 반영(Preview DB). 카드뉴스 생성은 AI 차단으로 실패하는 것이 정상이다(`PREVIEW_ALLOW_AI` 미설정). "Instagram 발행"은 차단 오류로 끝나고 상태가 `failed`(재시도 가능)로 남아야 한다. 실제 게시 0건.
11. **실기기:** iOS Safari, Android Chrome. 메뉴, 구독, 목록 레이아웃 이동, 상세 리드를 확인하고 스크린리더(VoiceOver/TalkBack)로 상세 페이지 구조를 확인한다.

**Production 무영향 확인:** Preview 배포 전후로 운영 사이트 홈·상세 응답, Vercel Production 배포 id가 그대로인지 확인한다. 운영 DB에는 아무 작업도 하지 않았으므로 데이터 변화가 없어야 한다.

### 중단과 복구 (Preview 단계)

| 상황 | 조치 |
|---|---|
| health가 `preview`가 아니거나 `databaseIsolated=false` | Preview 배포를 삭제(또는 보호)하고 env를 고친 뒤 재배포. 코드는 이 경우에도 DB·외부 호출을 막는다 |
| Preview에서 운영 데이터가 보임 | 즉시 Preview 배포 삭제, Preview env의 Supabase 값 확인. 운영 키가 들어갔다면 운영 service_role 키 교체 |
| Preview DB 초기화 실패 | 프로젝트를 지우고 다시 만든다(운영 무관). 원인은 001a와 운영 실제 정의 차이일 가능성이 크다 |

## 12–15. Production 전환 (최종 승인 후 — 이번 범위 아님)

12. **운영 DB 상태 재확인(읽기 전용)** — `check-production-schema.sql`로 실제 적용 상태를 기록하고 필요한 마이그레이션을 정한다.
    - 016(구독) — 현재 코드의 구독에 필수
    - 017
    - 018–022 — Brand Watch, 각 파일 상단의 "LOCAL ONLY until separately approved" 별도 승인 필요
    - 023 — 카드뉴스 발행에 필수
    - **024 — 필수. 없으면 공개 AI 기능 전부 503(fail-closed)**
13. **최종 승인 조건** — 아래가 모두 충족돼야 한다.
    - Preview 스모크 통과
    - 개인정보 고지 확정([privacy-subscription.md](privacy-subscription.md))
    - 운영 마이그레이션 적용 계획 승인
    - `npm run release:preflight -- --target production --env .env.production.local --schema production-schema.csv --run-tests` PASS
14. **순서:** 운영 DB에 필요한 마이그레이션 적용(백업 확인 후) → `master`를 release로 fast-forward → Production 배포.
    - DB 먼저: 모든 마이그레이션이 추가형이라 기존 코드는 새 스키마에서도 동작한다(`tests/release-migrations.test.mjs`).
15. **배포 후 모니터링(첫 24시간):**
    - Vercel 함수 오류율과 크론 실행 로그(ig-daily, collect, newsletter)
    - 구독 성공률
    - `ai_usage` 일일 합계, AI 경로 503 비율(024·권한 문제 신호)
    - 카드뉴스 `needs_review` 건수
    - Lighthouse로 홈·목록·상세 확인

## 롤백 — 코드와 DB는 따로

마이그레이션 016–024는 추가형이다(테이블·컬럼 삭제, 이름 변경, 타입 변경 없음 — 테스트로 고정). 따라서 **코드 롤백만으로 서비스가 이전 상태로 돌아가며, DB 롤백은 필요하지 않다.** 각 파일의 Rollback SQL은 별도 승인 없이는 실행하지 않는다.

| 상황 | 즉시 조치 | 후속 |
|---|---|---|
| 공개 페이지 장애 | Vercel에서 직전 Production 배포로 Instant Rollback | 원인 수정 후 Preview부터 재진행 |
| 관리자 로그인 장애 | `ADMIN_EMAIL` 설정 확인(비어 있으면 모두 거부). 필요 시 롤백 | proxy·`requireAdmin` 로그 확인 |
| 운영이 Preview처럼 차단됨 | Production env에 `MARKLENS_DEPLOYMENT`가 들어갔는지 확인 → 제거 후 재배포 | 게이트가 잡았어야 할 항목 — 실행 기록 확인 |
| 공개 AI 전부 503 | 024 적용·`consume_ai_quota` 실행 권한 확인, `AI_KILL_SWITCH` 확인 | Supabase 로그 |
| Insight 조회 실패 | 롤백. 017 트리거는 조회와 무관하다 | Supabase 로그·RLS 확인 |
| Brand Watch 마이그레이션 실패 | 해당 트랜잭션은 BEGIN/COMMIT으로 원자적이다 — 실패하면 적용되지 않는다. 코드 배포는 보류한다 | 원인 수정 후 Preview DB에서 재검증 |
| 뉴스레터 발송 오류 | 호 상태 확인(`sent` 선점). 한 통도 못 보냈으면 자동으로 이전 상태로 돌아간다. 일부만 나갔으면 재발송하지 말고 Brevo 로그로 대상 확인 | 실패 대상만 별도 승인 후 처리 |
| IG·Threads 발행 오류 | Social의 "확인 필요" 항목을 플랫폼에서 직접 확인해 "게시됨으로 기록" 또는 "재시도 가능으로 해제". 자동 재발행은 없다 | 토큰 만료면 health 확인 후 갱신 |
| 배포 후 성능 급락 | Lighthouse·Vercel Analytics로 범위 확인. 사용자 영향이 크면 롤백 | R-1 기준(모바일 실측 LCP 홈 3.4s·상세 3.2s·목록 2.7s)과 비교 |
| AI 비용 급증 | `AI_KILL_SWITCH=on`으로 재배포(즉시 전체 정지), 또는 `AI_DAILY_LIMITS`를 낮춰 재배포 | `ai_usage`로 원인 기능·키 확인 |

롤백 후에도 남는 것:
- 023·024의 새 컬럼·테이블. 이전 코드는 무시한다.
- 이미 기록된 `ai_usage` 행.
- 데이터 변경(발송된 메일, 게시된 글)은 되돌릴 수 없다. 이것이 Preview 차단과 선점 로직이 필요한 이유다.
