# MarkLens Production 출시 계획 (R-4)

이 문서는 실행 기록이 아니라 **승인용 계획**이다. 운영 DB·Production 배포·Production 환경 변수는 R-4에서 바꾸지 않았다. 각 단계는 별도 승인 후 실행한다.
배경: [README.md](README.md)(환경·차단 정책), [preview-runbook.md](preview-runbook.md)(Preview), [privacy-policy-draft.md](privacy-policy-draft.md)(개인정보).

## 출시 순서 (2026-10-25 운영 점검 반영 — 개인정보 확정이 배포보다 먼저)

운영 점검 결과(Audit 1·2, 읽기 전용): 001–016 적용, 017–024 미적용. **025의 권한 11개는 이미 있다** — 게다가 `authenticated`가 회원 테이블 3개에 모든 권한(TRUNCATE·REFERENCES·TRIGGER, 세션 UPDATE/DELETE, 통계 DELETE 포함)을 가진다. RLS 4/4·정책 10개는 정상. Insight Lab은 **운영에서 이미 저장 중**(세션 1·통계 1·노트 0). 자동 발행 `ig_auto_publish`·`site_publish_auto` = on, `curation_auto_publish` 행 없음(= off).

| 순서 | 단계 | 새 개인정보 처리 시작? | 조건 |
|---|---|---|---|
| 1 | A-1 읽기 전용 점검(완료) + 백업·복원 시험 | 아니오 | — |
| 2 | **B 개인정보 확정** → `PRIVACY_FACTS` 커밋 → Preview에서 고지·처리방침 확인 | 아니오 | 운영자 결정 + 법률 검토 |
| 3 | 묶음 1a: 017 → 023 → 024 → **026**(권한 축소) | 아니오 — master 코드는 017/023/024 객체를 쓰지 않고, 026은 권한을 줄이기만 한다(025는 운영에서 이미 충족 — 실행해도 변화 없음) | 백업 확인 후. 2와 병행 가능 |
| 4 | **코드 배포**(C) | **예** — `ai_usage`(회원 ID 또는 IP 해시 일별 집계) | **2 완료 후에만** |

- 새 코드는 024가 있으면 공개 AI 호출마다 `ai_usage`에 회원 ID 또는 IP 해시를 기록한다(024가 없으면 공개 AI 전부 503). 그래서 **코드 배포가 2에 묶인다.**
- 2 이전에 코드를 내보내는 유일한 방법은 Production `AI_KILL_SWITCH=on`(환경 변수 변경, 별도 승인)인데, 공개 AI뿐 아니라 **크론의 AI 콘텐츠 생성도 멈춘다** — 권장하지 않는다.
- 이미 운영 중인 처리(뉴스레터 구독, Insight Lab OTP 로그인 계정과 세션·노트·통계 저장, 피드백 코멘트의 Brevo 메일)도 공개된 처리방침이 없다. 이번 출시가 만든 문제는 아니지만 2에서 함께 해소한다.
- 026 이전의 초과 권한은 API로는 쓸 길이 없다(PostgREST는 TRUNCATE를 노출하지 않고, 세션 UPDATE/DELETE·통계 DELETE는 정책이 없어 RLS가 거부). 그래도 TRUNCATE는 RLS 밖이라 SQL 수준에서는 다른 회원의 세션까지 지울 수 있다(`tests/insight-lab-access.test.mjs`) — 1a에 포함해 없앤다.

## 0. 현재 상태 (2026-10-25 확인)

| 항목 | 값 |
|---|---|
| Production | `marklens.site`, Vercel `dpl_DtbqqctAh6BaNBaa8ARynkByHqcj`, branch `master` @ `342c59c` |
| 릴리즈 | `release/brand-watch-v1` — master보다 67커밋 앞, 뒤처짐 0(fast-forward 가능), 삭제·이름 변경된 라우트 0, `vercel.json`(크론) 동일 |
| 운영 DB | 001–016 적용, 017–024 미적용, 025 권한은 이미 있음(+초과 권한 → 026), Postgres 17.6. 규모: insights 1,903(12 MB), articles 2,968, cardnews 165(560 kB, IG 게시 66), 구독 active 9·pending 2, auth 사용자 1 |
| 운영 Supabase 플랜 | Free — **자동 백업·백업 다운로드 없음**(Supabase 문서). 변경 전 직접 백업 필수 |
| Production 환경 변수 | 필수 13개 존재, Preview 전용 값(`MARKLENS_DEPLOYMENT`, `PREVIEW_ALLOW_AI`, `AI_KILL_SWITCH`) 없음, `disabled-in-preview` 자리표시자 없음. 공개 값: 사이트 `https://marklens.site`, Supabase ref `ndehtnchkgvpjbxlkazk` |

## A. 운영 DB 변경 승인안

### A-1. 적용 전 (읽기 전용, 승인 필요 없음 — 운영자 실행)

1. `scripts/release/check-production-schema.sql` → 25개 번호 중 001–016만 `true`인지 다시 확인(마지막 결과 CSV 보관).
2. `scripts/release/production-readiness.sql` → 건수·평균 행 크기·Insight Lab 권한·자동 발행 플래그·묶음 1 전제 조건(`pre 017`~`pre 025` 행, CSV 보관).
   - `flag: ig_auto_publish` 등이 `on`이면 배포 후 첫 크론이 실제로 게시한다 — 출시 당일엔 `off` 권장(변경은 별도 승인).
   - 두 SQL 모두 SELECT 하나뿐이다. 운영 SQL Editor에는 맨 앞에 `SET TRANSACTION READ ONLY;`를 붙여 실행한다(쓰기가 섞여 있어도 거부된다).
3. **백업** — Free 플랜은 자동 백업이 없고, Supabase 문서는 `supabase db dump`로 직접 내보내라고 권한다. 운영자 PC에서 Docker Desktop을 켜고:
   `powershell -ExecutionPolicy Bypass -File scripts/release/backup-production.ps1 -Expect <production-readiness.csv>`
   - 연결 문자열(Supabase → Connect → Session pooler, 비밀번호 포함)은 숨김 입력으로만 받고 저장·출력하지 않는다. 운영 ref가 아니면 거부한다.
   - roles.sql·schema.sql·data.sql(auth 포함, `COPY` 형식)을 `%USERPROFILE%\MarkLens-backups\prod-<시각>`에 쓰고, `verify-backup.mjs`가 파일 크기·SHA-256·테이블별 행 수를 점검해 manifest.json을 남긴다. 점검이 통과해야 백업 완료다.
   - Storage 버킷의 **파일**은 포함되지 않는다(묶음 1은 Storage를 건드리지 않는다).
4. **복원 시험**(운영 DB 밖) — 로컬 Docker의 격리된 Supabase 스택에 문서의 복원 명령(`psql --single-transaction -v ON_ERROR_STOP=1 -f roles.sql -f schema.sql -c 'SET session_replication_role = replica' -f data.sql`)으로 복원하고, 같은 두 점검 SQL로 운영 결과와 비교한다.

### A-2. 적용할 SQL과 순서

| 묶음 | 파일 | 바뀌는 것 | 기존 데이터 영향 | 잠금 | 코드 의존 |
|---|---|---|---|---|---|
| 1a (필수, 코드 배포 전) | `017_insight_content_timestamp.sql` | insights 갱신 트리거 함수 교체(조회수만 바뀔 때 `updated_at` 유지) | 없음(백필 없음) | insights 트리거 교체 순간 짧은 배타 잠금 | 없음(권장) |
| 1a | `023_cardnews_channel_publish_state.sql` | cardnews에 채널별 상태 컬럼 8개 + CHECK 2개 | 없음(새 컬럼 NULL, CHECK는 새 컬럼만 검사). CHECK 추가 시 cardnews 전체를 한 번 훑는다 | cardnews ACCESS EXCLUSIVE(행 수만큼, A-1의 건수 참조) | **필수**: 없으면 카드뉴스 발행 실패, 관리자 Social 화면 오류 |
| 1a | `024_ai_usage_quota.sql` | `ai_usage` 테이블 + `consume_ai_quota()` | 없음 | 새 객체만 | **필수**: 없으면 공개 AI 전부 503 |
| — | `025_insight_lab_access.sql` | Insight Lab 테이블 GRANT | 없음 | — | **운영은 이미 충족(11/11)** — 실행해도 변화 없음. 026이 같은 권한 집합을 정확히 다시 부여하므로 따로 실행하지 않는다 |
| 1a | `026_insight_lab_least_privilege.sql` | anon·authenticated의 Insight Lab 권한을 025 집합으로 재설정(REVOKE ALL + GRANT, 한 트랜잭션) | 없음(행 변경 없음) | 4개 테이블 권한 변경 순간 짧음 | 라우트가 쓰는 권한은 그대로 — Insight Lab 동작 유지. RLS가 꺼져 있으면 스스로 중단 |
| 2 (**별도 승인**) | `018`→`019`→`020`→`021`→`022` | Brand Watch 테이블·함수·트리거 | 기존 테이블 변경 없음(018 머리말) | 새 객체 위주 | 선택: 없으면 공개 Brand Watch는 정적 데이터로 정상, **관리자 Brand Watch만 "불러올 수 없음"** 상태 |

- 묶음 1의 네 파일은 서로 의존하지 않는다(파일 간 참조 없음). 번호 순으로 하나씩 실행하고 매번 `check-production-schema.sql`로 해당 번호가 `true`인지 확인한다.
- 전제 조건은 `production-readiness.sql`의 `pre` 행으로 확인한다: 017은 트리거 함수가 읽는 insights 컬럼 20/20(하나라도 없으면 insights UPDATE 전부 실패), 023은 새 컬럼 0/8·제약 0/2, 024는 false, 025는 RLS 켜진 테이블 4/4(아니면 025가 스스로 중단).
- 각 파일은 `BEGIN…COMMIT` — 오류가 나면 그 파일은 하나도 적용되지 않는다. **오류가 나면 거기서 멈추고** 메시지를 기록한다(다음 파일로 넘어가지 않는다, 같은 파일 재실행 전 원인 확인).
- 018–022는 머리말대로 "LOCAL ONLY until separately approved". 이 계획은 자동 적용하지 않는다.

### A-3. 기존 코드와의 호환 (DB 먼저 적용하는 이유)

묶음 1을 적용한 뒤 코드 배포 전까지는 **현재 운영 코드(master)가 새 스키마 위에서 돈다.**
- 017: 트리거만 바뀜 — 동작 동일(조회수 갱신 시 `updated_at` 유지로 sitemap lastmod가 덜 흔들림).
- 023: 기존 코드는 `posted_at`·`ig_post_id`·`publish_status`만 쓴다 — 새 컬럼은 NULL 허용, CHECK도 새 컬럼만(`tests/release-migrations.test.mjs`의 "old writes unaffected").
- 024: 기존 코드는 쓰지 않는다.
- 026: 초과 권한만 회수한다. master의 Insight Lab 라우트가 쓰는 권한(025 집합)은 같은 트랜잭션에서 다시 부여되므로 동작은 그대로다.

반대 순서(코드 먼저)는 장애다: 024 없으면 공개 AI 503, 023 없으면 발행·Social 화면 오류.

### A-4. 적용 시간대와 중단 기준

- 크론(UTC): collect 00:00, ig-daily 23:00, newsletter 일 22:30, quiz-seed 일 17:00, curation-weekly 월 00:00. → **평일 KST 13:00–17:00** 권장(월요일 오전 제외).
- 중단: 어느 파일이든 오류 / check 결과가 기대와 다름 / 사이트 오류율 상승.
- 복구: 묶음 1은 모두 추가형 — 되돌릴 필요가 없다. 꼭 되돌려야 하면 각 파일의 Rollback 주석(별도 승인). **DB 롤백과 코드 롤백은 별개다**: 코드를 되돌려도 스키마는 남고, 이전 코드는 새 컬럼·테이블을 무시한다.

## B. 개인정보 고지 확정안

- 코드는 준비됐고 **미공개** 상태다(`src/lib/legal/privacy.ts`의 확정 항목이 비어 있으면 `/privacy` 404, 고지·링크 없음).
- 운영자가 정할 항목과 법률 검토 사항: [privacy-policy-draft.md](privacy-policy-draft.md) "운영자가 확정해야 할 항목".
- 공개 가능 조건: 모든 항목 확정 + 광고성 정보 동의 판단이 `notice-only` + 국외 이전 검토 완료 + **보유 기간 경과 기록 파기 절차 확정(현재 코드에 없음)**.
- **B는 코드 배포(C)의 선행 조건이다.** 확정된 값을 `PRIVACY_FACTS`에 넣은 커밋을 Preview에서 확인한 뒤, 그 SHA를 C의 배포 대상으로 쓴다 — 처리방침·고지가 새 처리와 같은 배포로 함께 나간다.
- 파기 절차는 문서화된 수동 절차(누가·언제·무엇을·어떻게)로 시작할 수 있다. 자동 파기 구현은 그 결정 뒤 별도 작업이다.

## C. 코드 출시안

1. **커밋 고정**: Preview에서 검증한 `release/brand-watch-v1`의 SHA를 기록한다. 이후 그 브랜치에 새 커밋이 생기면 Preview부터 다시. 선행 조건: B 완료(그 SHA에 확정된 `PRIVACY_FACTS` 포함), 묶음 1a(017·023·024·026) 적용.
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

### 자동 발행 전환 (플래그는 끄지 않는다)

운영 플래그 `ig_auto_publish`·`site_publish_auto`는 on이고 그대로 둔다. 새 코드에서 두 플래그가 하는 일은 같다(IG 하루 1건 08:00 KST, 사이트 공개 09:00 KST). 달라지는 건 IG 발행이 023의 상태 컬럼으로 **한 번만** 잡힌다는 점이다.
- 기존 게시분 66건은 `posted_at`이 있어 새 코드가 "이미 발행"으로 본다 — 재게시 없음. Threads 수동 재시도는 `failed` 상태에서만 가능해, 상태가 비어 있는 기존 카드는 Threads에도 다시 나가지 않는다.
- **배포 시각**: 화–목 KST 13:00–17:00. 크론이 없는 구간이고(08:00 IG, 09:00 수집·사이트 공개, 월 07:30 뉴스레터·09:00 큐레이션·02:00 퀴즈), 첫 자동 발행(다음 날 08:00)까지 점검 시간이 15시간 남는다.
- **배포 직후~당일 저녁**: 관리자 Social 화면 정상, 023 컬럼 존재(check SQL), 아래 조회에서 `publishing`·`needs_review` 0건.
- **다음 날 08:00 이후**: 새로 발행된 1건이 `ig_publish_state = published`, Instagram 계정에 중복 게시 없음, Vercel 크론 로그 정상.
- **중단 수단**: 전날 저녁 점검에서 이상이 보이면 운영자가 관리자 화면의 기존 자동 발행 스위치로 `ig_auto_publish`를 끈다(운영자 판단, 원인 해결 후 다시 켬). 코드 롤백만으로는 023 상태가 남는다는 점에 유의.

```sql
-- 읽기 전용: 채널별 발행 상태 분포(행 내용 없음)
SELECT coalesce(ig_publish_state, 'null') AS ig, coalesce(threads_publish_state, 'null') AS threads, (posted_at IS NOT NULL) AS ig_posted, count(*)
FROM public.cardnews GROUP BY 1, 2, 3 ORDER BY 4 DESC;
```
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
