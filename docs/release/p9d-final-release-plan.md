# Career Lab 최종 출시 계획 (P9D)

**기준:** RC2 `fdda8bf`는 P9C에서 실제 Preview 브라우저 160/160, 빌드 93/93을 통과했다. RC3 준비 브랜치는 그 위에 개인정보처리방침 수정만 얹었다. master(`9ff0b90`), Production(`784cda4`), Vercel 설정, 운영 DB는 변경하지 않았다.

출시 전략은 Production의 AI 킬 스위치를 켠 채로, 일반 면접과 저장된 객관식 학습을 제공하고 AI 피드백과 맞춤 질문은 이용 불가로 명시하는 것이다. 기술적으로 가능하다는 이유만으로 출시하지 않는다.

## 1. 운영 DB 퀴즈 확인

**스키마(저장소의 Preview 재현본 기준):** `public.quiz_questions(id, level, type, data jsonb, created_at)`. 앱은 `random_quiz(p_level, p_type, p_count)`로 조회한다. AI 중단 시 `learn/generate`는 `multiple_choice`만 요청하고, `data.type`도 객관식인 행만 쓰며, 질문 앞 20자 기준으로 유사문제를 제거한다. 화면의 문제 수는 5, 10, 20이다.

**SQL:** [`p9d-quiz-db-check.sql`](p9d-quiz-db-check.sql). SELECT 한 문장이고 문제 본문은 조회하지 않는다. 임시 로컬 DB의 읽기 전용 트랜잭션에서 합성 데이터로 집계 정확성을 확인했다. **운영 DB에서는 실행하지 않았다.**

**최소 권한과 실행 방법(운영자 본인이 실행):**
- 필요한 권한은 `public.quiz_questions` SELECT뿐이다. 서비스 키나 DB 비밀번호를 전달하지 않는다.
- 방법 A: Supabase Dashboard → 운영 프로젝트 → SQL Editor에 파일 내용을 붙여 넣고 한 번 실행한 뒤 결과 표만 공유한다.
- 방법 B(읽기 전용 강제): `PGOPTIONS='-c default_transaction_read_only=on' psql "<연결 문자열>" -f docs/release/p9d-quiz-db-check.sql`

**판정 (`multiple_choice` 행의 `distinct_ai_off`, 세 난이도 각각):**

| 결과 | 판정 | 대응 |
|---|---|---|
| 모두 10 이상 | 정상 | 그대로 진행. 20 미만이면 20문제 선택 시 부족 안내가 나오는 것을 확인(이미 구현) |
| 일부 1~9 | 부족 | 출시는 가능하나 기본 10문제에서 부족 안내가 나온다. 운영자 승인으로 문제 보충을 결정 |
| 일부 또는 전부 0 | 0개 | 해당 난이도는 "제공할 문제 없음" 안내만 나온다. 보충 전에는 학습 퀴즈를 출시 범위에서 제외 |
| `type_mismatch`·`invalid_choices`가 큼 | 데이터 이상 | 해당 행은 AI 중단 시 제공되지 않거나 채점이 틀릴 수 있어 원인 확인 후 판정 |

AI가 멈춘 동안 주간 시드는 문제를 지우기 전에 건너뛰므로 풀이 사라지지는 않지만 새로 채워지지도 않는다. 보충은 수동 AI 시드(유료)나 검수한 문제의 INSERT(운영 DB 쓰기)이며 둘 다 별도 승인 대상이다.

## 2. Preview 인증 정보

변수 이름과 범위만 확인했고 값은 조회하지 않았다. 현재 범위는 Vercel 프로젝트 `marklens` 기준이다.

**확정한 변경 범위 (P9E, 실행 전 이름·범위 목록 재확인, Development 항목은 건드리지 않음):**

| 변수 | 현재 Preview 범위 | 조치 | Production 영향 |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | 전체 브랜치 + `release/brand-watch-v1` | 전체 브랜치 항목 삭제 | 없음(별도 항목) |
| `AWS_REGION` | 전체 브랜치 | 항목 삭제 | 없음(별도 항목) |
| `REMOTION_SERVE_URL` | 전체 브랜치 + `release/brand-watch-v1` | 전체 브랜치 항목 삭제 | 없음(별도 항목) |
| `UNSPLASH_ACCESS_KEY` | 전체 브랜치 + `release/brand-watch-v1` | 전체 브랜치 항목 삭제 | 없음(별도 항목) |
| `SHOTSTACK_API_KEY` | **Production과 한 항목 공유** + `release/brand-watch-v1` | **삭제 금지.** 공유 항목의 대상에서 Preview만 제거 | 항목 삭제 시 Production 값도 사라짐 |
| `GA4_PROPERTY_ID`, `GA4_SA_CLIENT_EMAIL` | **Production과 한 항목 공유** | **삭제 금지.** 대상에서 Preview만 제거 | 항목 삭제 시 관리자 지표 중단 |
| `release/brand-watch-v1` 전용 항목 | 해당 브랜치만 | 이번 범위 제외, 그 브랜치 재개 여부 결정 후 처리 | 없음 |

공유 항목은 값이 write-only인 Secret이다. 대상 변경 화면에서 값을 다시 입력하라고 하면 **저장하지 말고 중단**한다(Vercel 문서로 동작 미확인). `GA4_SA_PRIVATE_KEY`, `REMOTION_FUNCTION_NAME`은 Preview에 없다.

- **실제 사용:** `SHOTSTACK_*`은 `src`에서 참조하지 않는다. AWS는 관리자 Shorts 경로에서만 쓰며, 렌더와 S3 삭제는 Preview 가드로 차단된다. 상태 조회 등 나머지도 관리자 로그인이 필요하고 RC2 Preview의 관리자 경로는 503이다. Career Lab 검증에는 필요 없다.
- **위험:** 모든 Preview 빌드의 실행 환경에 들어간다. Deployment Protection은 접속만 막으므로, 저장소에 push할 수 있는 사람이나 악성 의존성이 코드로 읽을 수 있다. 이 키의 IAM 권한 범위, Production 키와 값이 같은지는 미확인이다.
- **Production 영향:** AWS와 Remotion의 Preview 항목은 Production 항목과 분리돼 있어 지워도 영향이 없다. **`SHOTSTACK_API_KEY` 공유 항목은 삭제하면 Production도 사라지므로 대상에서 Preview만 빼야 한다.**
- **브랜치 분리:** 가능하다. Shorts를 Preview에서 시험할 때만 해당 브랜치에 별도 저권한 키를 넣는다.

**권장 순서 (승인 후):**
1. AWS 콘솔에서 해당 IAM 키의 마지막 사용일과 권한을 확인한다.
2. 변경 전 이름·범위 목록을 저장한다.
3. 위 표대로 전체 브랜치 항목을 삭제하고, 공유 항목은 Preview 대상만 제거한다.
4. 변경 후 목록을 비교해 Production 항목이 그대로인지 확인한다.
5. 변경은 새 배포에만 적용되므로 최종 RC Preview 전에 끝내고, 값을 쓰던 기존 Preview 배포는 정리한다.
6. Preview와 Production 키 값이 같다면 Production 키를 별도 일정으로 교체한다.

## 3. 자동 배포 구조

`marklens`와 `mark-lens`가 같은 저장소와 `master`를 Production 브랜치로 연결하고 있어, push 한 번에 두 프로젝트가 각각 빌드한다. `mark-lens`는 환경 변수 0개, 기본 도메인뿐이고 성공한 Production 배포가 없다. 실제 서비스 도메인(`marklens.site`)은 `marklens`에 있다.

| 방안 | 효과 | 판단 |
|---|---|---|
| `mark-lens`의 Git 연결 해제 | 중복 빌드 제거 | **권장.** 사용하지 않는다는 운영자 확인 후 |
| Ignored Build Step | 건너뛴 빌드도 배포 수에 집계된다(Vercel 문서) | 절감 효과가 없어 비권장 |
| `vercel.json`의 `git.deploymentEnabled`로 작업 브랜치(`claude/*`, `codex/*`, `integrate/*`) 제외 | 불필요한 Preview 감소 | 후속 적용. 같은 저장소의 두 프로젝트에 함께 적용되는지는 문서로 미확인이므로 시험 후 적용 |

## 4. 최종 RC 제작 순서

| # | 작업 | 승인 |
|---|---|---|
| 1 | 운영 DB SQL 실행, 위 판정 | 운영 DB 조회 승인 |
| 2 | Gemini 등급 확인(`geminiPaidConfirmed`), 방침 전문가 검토(`overseasTransferReviewed`) | 운영자·전문가 |
| 3 | 공개일 결정, `effectiveDate`와 테스트 갱신. 미확정이면 시행 중인 방침으로 출시되고 개정본은 다음 배포로 미룬다 | 운영자 |
| 4 | Preview 인증 정보 정리, `mark-lens` 처리 | Vercel 변경 승인 |
| 5 | 최종 RC 브랜치 push, 브랜치 전용 `MARKLENS_DEPLOYMENT=preview`, Preview 재배포 | push·Vercel 승인 |
| 6 | 전체 회귀: 테스트, 빌드, 브라우저 160개, 방침 25개, 서버 API | 우회 키 전달 |
| 7 | 실기기 QA 수행 (`p9d-device-qa-checklist.md`) | 운영자 수행 |
| 8 | Production 승인 후 master를 최종 RC로 한 번에 fast-forward | **Production 승인** |

RC2와 `784cda4` 사이에 DB 마이그레이션, `vercel.json`, `proxy.ts` 차이는 없다. 최종 RC에서 다시 확인한다.

## 5. 출시와 롤백

- 출시 전 Production의 `AI_KILL_SWITCH=on`, `AI_AUTO_PAUSED=on`을 이름·값 형태로 다시 확인한다.
- 롤백 대상은 현재 Production 배포 `dpl_CEwdkL49JahYsYyUbsE3PuGkQ8iY`(`784cda4`)다. Hobby 요금제의 즉시 롤백은 직전 배포까지만 가능하므로 출시 직전과 직후에 다른 Production 배포를 끼워 넣지 않는다.
- 즉시 롤백 후에는 Production 도메인 자동 연결이 꺼진다. 복구 후 Vercel에서 해제하거나 `vercel promote`로 되돌린다.
- 롤백은 코드만 되돌린다. 롤백하면 방침은 이전 시행본으로 돌아가므로 공개 안내도 함께 수정한다.
- 출시 후 `/`, `/interview`, `/interview/prep`, `/learn`, `/privacy`, `/privacy/2026-10-25`, AI 차단 응답, Production 로그를 확인한다.

## 6. Career Lab 2.0으로 넘길 일

- 실제 404 응답(Soft 404 해소)
- AI 중단 시 맞춤 면접 폼 자체를 숨기기 (QA 구조 변경 선행)
- `InterviewSession.tsx` 분리
- 면접 질문·AI 분석·피드백 고도화
- 지침이 권장하는 "알기 쉬운 처리방침"과 AI 처리 흐름도
