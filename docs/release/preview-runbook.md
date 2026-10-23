# Preview → Production 실행 계획 (R-2)

R-2 시점에는 1–6단계의 준비 문서와 도구만 있다. 7단계 이후(Push, 배포, DB 적용)는 실행하지 않았다. 각 단계의 **게이트**를 통과하지 못하면 다음 단계로 가지 않는다.

## 0. 리소스 현황

| 리소스 | 상태 | 근거 |
|---|---|---|
| Vercel 프로젝트 | 있음(메인 체크아웃이 연결됨) | `.vercel/project.json` |
| 운영 Supabase(`ndeh…`) | 있음 | migrations README, `.env.local` |
| **Preview 전용 Supabase 프로젝트** | **없음 — 새로 필요** | 연결 근거 없음 |
| Preview 전용 IG·Threads 테스트 계정, Brevo 샌드박스, AWS 렌더 경로 | 없음 — Preview에서는 코드로 차단되므로 필수 아님 | — |
| Preview 환경 변수 세트 | 확인 불가(대시보드) — 새로 구성 | — |

## 1–6. 준비 (로컬·대시보드, 운영 무변경)

1. **복구 지점 확인** — 현재 Production 배포 id와 `origin/master` 커밋을 기록한다(`vercel ls`, Vercel 대시보드). 롤백 대상이다.
2. **Git 확인** — `release/brand-watch-v1`이 `origin/master`를 모두 포함하는지 확인한다(`git rev-list --count release/brand-watch-v1..origin/master` = 0).
3. **Preview DB 준비** — 새 Supabase 프로젝트를 만든다. 운영 데이터는 복사하지 않고, 공개 샘플 데이터만 넣는다.
   - 저장소의 마이그레이션은 처음부터 DB를 만들지 못한다: `cardnews`·`app_config` 등은 저장소 밖(대시보드)에서 만들어졌다. 운영 스키마를 **구조만**(`pg_dump --schema-only`, 읽기) 떠서 Preview에 적용하거나, 부족한 테이블을 별도 SQL로 정의해야 한다.
   - **게이트:** Preview 프로젝트 ref ≠ 운영 ref.
4. **Preview 환경 변수** — Vercel Preview 범위에 Preview DB 주소·키, 테스트용 `ADMIN_EMAIL`·`CRON_SECRET`·`N8N_WEBHOOK_SECRET`, Preview URL(`NEXT_PUBLIC_SITE_URL`)을 넣는다. IG·Threads·Brevo·AWS·GA4 자격 증명은 넣지 않는다.
   - **게이트:** `vercel env pull .env.preview.local --environment=preview` 후 `node scripts/release/preflight-env.mjs .env.preview.local preview`가 FAIL 0.
5. **Preview DB에만 마이그레이션 적용** — 016 → 017 → 018–022 → 023 → 024 순서로 적용한다. 각 파일은 재실행해도 안전하다.
   - **게이트:** Preview SQL Editor에서 `scripts/release/check-production-schema.sql` 실행 시 016–024가 모두 `true`.
6. **부작용 차단 확인(로컬)** — `MARKLENS_DEPLOYMENT=preview`로 로컬 빌드를 띄워 `tests/preview-guard.test.mjs`와 같은 시나리오를 확인한다. 쓰기는 0건, 크론은 403, AI는 차단 또는 한도 적용이어야 한다.

## 7–11. Preview 배포·검증 (승인 후)

7. `git push origin release/brand-watch-v1` → Vercel이 Preview를 만든다(Production 무영향).
8. **첫 확인:** 관리자로 로그인한 뒤 `/api/admin/health`를 연다.
   - `release.deployment = "preview"`, `databaseIsolated = true`, `blocked`에 instagram·threads·email·aws·cron 포함.
   - 아니면 즉시 중단한다. 시스템 환경 변수 노출 설정을 확인한다.
9. **사용자 여정 스모크:**
   - 홈 → Hero → 상세(리드·목차) → 관련 글 → `/insights` 목록(초기 HTML에 목록) → Brand Watch 목록·상세 → Weekly 구독 1건(Preview DB에 저장되고 "확인 메일 발송 실패" 안내가 나오면 정상) → 모바일 메뉴.
   - 404·빈 화면·콘솔 오류가 없어야 한다.
10. **관리자·제작 흐름:** 기사 검수 → 발행 → 공개 반영(Preview DB). 카드뉴스 생성 → 렌더 → ZIP. "Instagram 발행"이 차단 오류로 끝나고 상태가 `failed`(재시도 가능)로 남는지 확인한다. 실제 게시 0건.
11. **실기기:** iOS Safari, Android Chrome. 메뉴, 구독, 목록 레이아웃 이동, 상세 리드를 확인하고 스크린리더(VoiceOver/TalkBack)로 상세 페이지 구조를 확인한다.

## 12–15. Production 전환 (최종 승인 후)

12. **운영 DB 상태 재확인(읽기 전용)** — 운영 SQL Editor에서 `check-production-schema.sql`을 실행해 실제 적용 상태를 기록한다. 필요한 마이그레이션을 정한다:
    - 016(구독) — 현재 코드의 구독에 필수
    - 017
    - 018–022 — Brand Watch, 각 파일 상단의 "LOCAL ONLY until separately approved" 별도 승인 필요
    - 023 — 카드뉴스 발행에 필수
    - 024 — AI 한도. 없으면 한도가 꺼진 채로 동작
13. **최종 승인 조건** — 아래가 모두 충족돼야 한다.
    - Preview 스모크 통과
    - 개인정보 고지 확정([privacy-subscription.md](privacy-subscription.md))
    - 운영 마이그레이션 적용 계획 승인
    - Production env preflight FAIL 0(`preflight-env.mjs … production`)
14. **순서:** 운영 DB에 필요한 마이그레이션 적용(백업 확인 후) → `master`를 release로 fast-forward → Production 배포.
    - DB 먼저: 모든 마이그레이션이 추가형이라 기존 코드는 새 스키마에서도 동작한다(`tests/release-migrations.test.mjs`).
15. **배포 후 모니터링(첫 24시간):**
    - Vercel 함수 오류율과 크론 실행 로그(ig-daily, collect, newsletter)
    - 구독 성공률
    - `ai_usage` 일일 합계
    - 카드뉴스 `needs_review` 건수
    - Lighthouse로 홈·목록·상세 확인

## 롤백 — 코드와 DB는 따로

마이그레이션 016–024는 추가형이다(테이블·컬럼 삭제, 이름 변경, 타입 변경 없음 — 테스트로 고정). 따라서 **코드 롤백만으로 서비스가 이전 상태로 돌아가며, DB 롤백은 필요하지 않다.** 각 파일의 Rollback SQL은 별도 승인 없이는 실행하지 않는다.

| 상황 | 즉시 조치 | 후속 |
|---|---|---|
| 공개 페이지 장애 | Vercel에서 직전 Production 배포로 Instant Rollback | 원인 수정 후 Preview부터 재진행 |
| 관리자 로그인 장애 | `ADMIN_EMAIL` 설정 확인(이제 비어 있으면 모두 거부). 필요 시 롤백 | proxy·`requireAdmin` 로그 확인 |
| Insight 조회 실패 | 롤백. 017 트리거는 조회와 무관하다 | Supabase 로그·RLS 확인 |
| Brand Watch 마이그레이션 실패 | 해당 트랜잭션은 BEGIN/COMMIT으로 원자적이다 — 실패하면 적용되지 않는다. 코드 배포는 보류한다 | 원인 수정 후 Preview DB에서 재검증 |
| 뉴스레터 발송 오류 | 호 상태 확인(`sent` 선점). 한 통도 못 보냈으면 자동으로 이전 상태로 돌아간다. 일부만 나갔으면 재발송하지 말고 Brevo 로그로 대상 확인 | 실패 대상만 별도 승인 후 처리 |
| IG·Threads 발행 오류 | Social의 "확인 필요" 항목을 플랫폼에서 직접 확인해 "게시됨으로 기록" 또는 "재시도 가능으로 해제". 자동 재발행은 없다 | 토큰 만료면 health 확인 후 갱신 |
| 배포 후 성능 급락 | Lighthouse·Vercel Analytics로 범위 확인. 사용자 영향이 크면 롤백 | R-1 기준(모바일 실측 LCP 홈 3.4s·상세 3.2s·목록 2.7s)과 비교 |
| AI 비용 급증 | `AI_DAILY_LIMITS`를 낮춰 재배포하거나 `global=0`(전체 중지) | `ai_usage`로 원인 기능·키 확인 |

롤백 후에도 남는 것:
- 023·024의 새 컬럼·테이블. 이전 코드는 무시한다.
- 이미 기록된 `ai_usage` 행.
- 데이터 변경(발송된 메일, 게시된 글)은 되돌릴 수 없다. 이것이 Preview 차단과 선점 로직이 필요한 이유다.
