# Career Lab에서 나온 공통 기술 메모 (P9B)

다른 프로젝트 코드는 변경하지 않았다. 이 저장소에서 MCLE, MPE, MQE, MarkLens Creative의 코드나 문서를 찾지 못해 아래 의존성은 코드로 확인된 부분만 적는다.

## 재사용할 수 있는 것

| 요소 | 위치 | 용도 |
|---|---|---|
| AI 실행 판단 | `src/lib/release/guard.mjs`, `aiPaused()` (`src/lib/ai/budget.ts`) | AI를 쓰는 모든 기능의 차단·중지 판단 |
| 일일 AI 한도 | `checkAiBudget` (`src/lib/ai/budget.ts`) | 공개 AI 호출 비용 상한, 오류 코드 `ai_paused` / `ai_quota` / `ai_unavailable` |
| 수동 AI 범위 | `src/lib/ai/manual-context.ts` | 자동 정지 중 승인된 호출 |
| DB 차단 클라이언트 | `guardedClient` (`src/lib/supabase/guard.ts`) | DB 변수 없는 Preview 빌드 |
| 브라우저 장치·음성 처리 | `src/lib/interview/voice.ts`, `support.ts` | 음성 인식·읽기, 장치 오류 분류 |
| QA 도구 | 저장소 밖 `MarkLens-career-lab-qa` (`cdp.mjs`) | 보호된 Preview 브라우저 QA, 우회 키 유출 테스트 |

## 다른 작업에 영향을 주는 조건

- **AI 스위치는 전체 프로젝트 공통이다.** `AI_KILL_SWITCH`가 켜진 동안 AI를 쓰는 어떤 기능도 동작하지 않는다. AI 의존 기능의 일정은 이 정책 결정에 묶인다.
- **`aiPaused()`로 나눈 화면은 빌드 시점에 정해진다.** 정적 페이지는 배포 때의 환경 변수로 렌더링되므로 스위치를 바꾸면 재배포해야 화면이 바뀐다(Vercel 환경 변수 자체도 새 배포부터 적용된다).
- **Vercel Hobby:** Production 롤백은 직전 배포 1단계, cron은 하루 1회 이하.
- **master push는 곧 Production 배포이고** 두 Vercel 프로젝트가 같은 저장소를 빌드한다.
- **이름 규칙 테스트:** `tests/site-regressions.test.mjs`가 "AI INTERVIEW" 표기를 고정한다. 이름을 바꾸려면 Career Lab 2.0에서 테스트와 함께 바꾼다.

## Career Lab 2.0으로 넘길 것 (이번에 하지 않음)

- `InterviewSession.tsx`(1,200줄 이상) 분리
- AI 정지 시 맞춤 면접 폼 자체를 숨기기: 현재 QA(P4 P11, P6 A1·C1)가 AI 꺼짐 환경에서 폼을 사용하므로 QA 구조 변경이 먼저 필요하다
- 면접 질문·AI 분석·피드백 고도화
