# MarkLens Production 출시 계획 (R-4)

이 문서는 실행 기록이 아니라 **승인용 계획**이다. 운영 DB·Production 배포·Production 환경 변수는 R-4에서 바꾸지 않았다. 각 단계는 별도 승인 후 실행한다.
배경: [README.md](README.md)(환경·차단 정책), [preview-runbook.md](preview-runbook.md)(Preview), [privacy-policy-draft.md](privacy-policy-draft.md)(개인정보).

## 0. 현재 상태 (2026-10-25 확인)

| 항목 | 값 |
|---|---|
| Production | `marklens.site`, Vercel `dpl_DtbqqctAh6BaNBaa8ARynkByHqcj`, branch `master` @ `342c59c` |
| 릴리즈 | `release/brand-watch-v1` — master보다 67커밋 앞, 뒤처짐 0(fast-forward 가능), 삭제·이름 변경된 라우트 0, `vercel.json`(크론) 동일 |
| 운영 DB | 001–016 적용, **017–025 미적용**(읽기 전용 점검 결과) |
| 운영 Supabase 플랜 | Free — **자동 백업·백업 다운로드 없음**(Supabase 문서). 변경 전 직접 백업 필수 |
| Production 환경 변수 | 필수 13개 존재, Preview 전용 값(`MARKLENS_DEPLOYMENT`, `PREVIEW_ALLOW_AI`, `AI_KILL_SWITCH`) 없음, `disabled-in-preview` 자리표시자 없음. 공개 값: 사이트 `https://marklens.site`, Supabase ref `ndehtnchkgvpjbxlkazk` |

## A. 운영 DB 변경 승인안

### A-1. 적용 전 (읽기 전용, 승인 필요 없음 — 운영자 실행)

1. `scripts/release/check-production-schema.sql` → 25개 번호 중 001–016만 `true`인지 다시 확인(마지막 결과 CSV 보관).
2. `scripts/release/production-readiness.sql` → 건수·평균 행 크기·Insight Lab 권한·자동 발행 플래그(CSV 보관).
   - `flag: ig_auto_publish` 등이 `on`이면 배포 후 첫 크론이 실제로 게시한다 — 출시 당일엔 `off` 권장(변경은 별도 승인).
3. **백업** — Free 플랜이라 대시보드 백업이 없다. 운영자 PC에서:
   `npx supabase db dump --db-url "<운영 DB 연결 문자열>" -f marklens-prod-<날짜>.sql` (+ `--data-only`로 데이터 별도)
   연결 문자열은 Supabase → Project Settings → Database. 파일은 저장소 밖에 보관한다.

### A-2. 적용할 SQL과 순서

| 묶음 | 파일 | 바뀌는 것 | 기존 데이터 영향 | 잠금 | 코드 의존 |
|---|---|---|---|---|---|
| 1 (필수, 코드 배포 전) | `017_insight_content_timestamp.sql` | insights 갱신 트리거 함수 교체(조회수만 바뀔 때 `updated_at` 유지) | 없음(백필 없음) | insights 트리거 교체 순간 짧은 배타 잠금 | 없음(권장) |
| 1 | `023_cardnews_channel_publish_state.sql` | cardnews에 채널별 상태 컬럼 8개 + CHECK 2개 | 없음(새 컬럼 NULL, CHECK는 새 컬럼만 검사). CHECK 추가 시 cardnews 전체를 한 번 훑는다 | cardnews ACCESS EXCLUSIVE(행 수만큼, A-1의 건수 참조) | **필수**: 없으면 카드뉴스 발행 실패, 관리자 Social 화면 오류 |
| 1 | `024_ai_usage_quota.sql` | `ai_usage` 테이블 + `consume_ai_quota()` | 없음 | 새 객체만 | **필수**: 없으면 공개 AI 전부 503 |
| 1 | `025_insight_lab_access.sql` | Insight Lab 테이블 GRANT(최소 권한) | 없음 | GRANT 순간 짧음 | 없으면 Insight Lab 조회·저장 실패(현재 운영도 같은 상태로 추정 — A-1의 grant 행으로 확인) |
| 2 (**별도 승인**) | `018`→`019`→`020`→`021`→`022` | Brand Watch 테이블·함수·트리거 | 기존 테이블 변경 없음(018 머리말) | 새 객체 위주 | 선택: 없으면 공개 Brand Watch는 정적 데이터로 정상, **관리자 Brand Watch만 "불러올 수 없음"** 상태 |

- 묶음 1의 네 파일은 서로 의존하지 않는다. 번호 순으로 하나씩 실행하고 매번 `check-production-schema.sql`로 해당 번호가 `true`인지 확인한다.
- 각 파일은 `BEGIN…COMMIT` — 오류가 나면 그 파일은 하나도 적용되지 않는다. **오류가 나면 거기서 멈추고** 메시지를 기록한다(다음 파일로 넘어가지 않는다, 같은 파일 재실행 전 원인 확인).
- 018–022는 머리말대로 "LOCAL ONLY until separately approved". 이 계획은 자동 적용하지 않는다.

### A-3. 기존 코드와의 호환 (DB 먼저 적용하는 이유)

묶음 1을 적용한 뒤 코드 배포 전까지는 **현재 운영 코드(master)가 새 스키마 위에서 돈다.**
- 017: 트리거만 바뀜 — 동작 동일(조회수 갱신 시 `updated_at` 유지로 sitemap lastmod가 덜 흔들림).
- 023: 기존 코드는 `posted_at`·`ig_post_id`·`publish_status`만 쓴다 — 새 컬럼은 NULL 허용, CHECK도 새 컬럼만(`tests/release-migrations.test.mjs`의 "old writes unaffected").
- 024: 기존 코드는 쓰지 않는다.
- 025: 권한만 추가 — 기존 코드의 Insight Lab이 오히려 동작하기 시작한다.

반대 순서(코드 먼저)는 장애다: 024 없으면 공개 AI 503, 023 없으면 발행·Social 화면 오류.

### A-4. 적용 시간대와 중단 기준

- 크론(UTC): collect 00:00, ig-daily 23:00, newsletter 일 22:30, quiz-seed 일 17:00, curation-weekly 월 00:00. → **평일 KST 13:00–17:00** 권장(월요일 오전 제외).
- 중단: 어느 파일이든 오류 / check 결과가 기대와 다름 / 사이트 오류율 상승.
- 복구: 묶음 1은 모두 추가형 — 되돌릴 필요가 없다. 꼭 되돌려야 하면 각 파일의 Rollback 주석(별도 승인). **DB 롤백과 코드 롤백은 별개다**: 코드를 되돌려도 스키마는 남고, 이전 코드는 새 컬럼·테이블을 무시한다.

## B. 개인정보 고지 확정안

- 코드는 준비됐고 **미공개** 상태다(`src/lib/legal/privacy.ts`의 확정 항목이 비어 있으면 `/privacy` 404, 고지·링크 없음).
- 운영자가 정할 항목과 법률 검토 사항: [privacy-policy-draft.md](privacy-policy-draft.md) "운영자가 확정해야 할 항목".
- 공개 가능 조건: 모든 항목 확정 + 광고성 정보 동의 판단이 `notice-only` + 국외 이전 검토 완료 + **보유 기간 경과 기록 파기 절차 확정(현재 코드에 없음)**.
- 확정 전 운영 출시는 기존 구독 폼 그대로 나간다(새로 수집하는 항목은 없다).

## C. 코드 출시안

1. **커밋 고정**: Preview에서 검증한 `release/brand-watch-v1`의 SHA를 기록한다. 이후 그 브랜치에 새 커밋이 생기면 Preview부터 다시.
2. **배포 방법: master fast-forward**
   ```
   git push origin <검증된 SHA>:master        # fast-forward만 — 실패하면 중단(강제 push 금지)
   ```
   Vercel이 master를 **Production 환경 변수로 새로 빌드**한다.
   - ⚠️ Vercel의 "Promote to Production"으로 Preview 배포를 올리지 않는다: Preview 빌드에는 Preview Supabase 주소(NEXT_PUBLIC_*)가 박혀 있다.
3. 환경 변수: 추가 필수 없음. 선택: `AI_DAILY_LIMITS`(기본값 chat 100·interview 60·learn 200·insight-lab 20·global 3000/일).
4. **복구 기준점**: 현재 Production `dpl_DtbqqctAh6BaNBaa8ARynkByHqcj` — 문제 시 Vercel Instant Rollback.
5. 배포 직후 확인(15분 안):
   - 홈·목록·상세·Brand Watch 200, 콘솔 오류 없음
   - `/api/admin/health`(관리자 로그인): `release.deployment = production`, `blocked = []`
   - 공개 AI 1회(챗) 200 — 024 동작, `ai_usage`에 1행 (**유료 호출 1회 — 출시 승인에 포함해 실행**)
   - Insight Lab 챌린지 목록 표시
   - 관리자 Social 화면 정상(023)
6. 중단 기준: 5의 어느 항목이든 실패, 함수 오류율 급증 → Instant Rollback(코드만). DB는 그대로 둔다.

## D. 출시 후 운영 계획

### 첫 24시간
- Vercel 함수 오류(5xx), 크론 실행 결과(collect·ig-daily·newsletter)
- `/api/subscribe` 성공률, 구독 확인 메일 도착(테스트 주소로 1회 — 실제 발송, 별도 승인)
- 카드뉴스: 자동 발행 플래그 상태 확인 후, 게시 테스트는 별도 승인으로 1건만(중복 게시 방지 claim이 023에 의존)
- `ai_usage` 기능별 일일 합계, 503(024·권한) 비율

### 첫 주 — Supabase Egress
| 지표 | 어디서 | 기존 수단 |
|---|---|---|
| 일별 Egress | Supabase → Usage | 있음 |
| PostgREST 요청 수 | Supabase → Reports(API) | 있음 |
| 배포·빌드 시 DB 조회 | 배포 시각과 일별 Egress 대조 | 있음(수동) |
| 상세 1건 응답 바이트 | `production-readiness.sql`의 평균 행 크기로 추정 | 추정만 — 정밀 측정은 추가 계측 필요 |
| 캐시 적중 | 응답 헤더 `x-vercel-cache` | 있음(표본) |
| 무료 한도 대비 | 5GB/월 | 있음 |

**추정식**(R-4 로컬 측정 + 운영 평균 행 크기):
- 이전 코드, 빌드 1회 ≈ 발행 상세 수 × 61 × (insight 행 + 원문) 평균 바이트. 10월 9–11일 Production 빌드 5회가 급증 구간과 겹친다 — 원인 가설(일별 Egress와 대조해 확인).
- 새 코드, 빌드 1회 ≈ 발행 상세 수 × 상세 1건(원문 제외 컬럼) + 워커 수 × 후보 61건.
- 새 코드, 상세 ISR 재생성 1회 ≈ 상세 1건(후보 풀은 서버 프로세스당 10분 1회 — 인스턴스가 자주 새로 뜨면 그만큼 늘어난다).

첫 주 점검표: 매일 Usage의 Egress·요청 수 기록 → 배포가 있던 날 표시 → 일 평균이 Free 한도(5GB/월 ≈ 하루 165MB) 안인지 → 넘으면 홈의 긴 본문 필드 조회(다음 최적화 후보)와 OG 경로부터 본다.
