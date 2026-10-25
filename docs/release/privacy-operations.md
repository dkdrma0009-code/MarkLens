# 개인정보 요청 처리와 정기 파기 (개인 운영)

MarkLens 개인정보처리방침([privacy-policy-draft.md](privacy-policy-draft.md))이 약속하는 삭제를 실제로 하는 최소 절차다. 앱에 자동 삭제 기능은 없고, 운영자가 아래 SQL을 운영 Supabase SQL Editor에서 실행한다. SQL: [`scripts/release/privacy-deletion.sql`](../../scripts/release/privacy-deletion.sql) — 실제 스키마에서 시험함(`tests/privacy-deletion.test.mjs`).

## 받는 곳

- 처리방침의 문의 메일(`PRIVACY_FACTS.contactEmail`)로 받는다. **`newsletter@marklens.site`는 받을 수 없다** — `marklens.site`에 MX 레코드가 없다(2026-10-25 확인, 발신 전용 Brevo 인증만 있음).
- 문의 메일이 정해지면 뉴스레터·구독 확인·온보딩 메일의 회신 주소(`replyTo`)도 그 주소가 된다(`mailReplyTo()`).

## 요청별 처리

| 요청 | 할 일 | 남는 것 |
|---|---|---|
| 뉴스레터만 그만 받기 | 메일 하단 구독 해지 링크(자동). 운영자 할 일 없음 | 구독 기록은 해지 상태로 보유 기간까지 → 정기 파기 |
| 구독 정보 삭제 | SQL **[A]** 에 그 이메일을 넣어 실행 | 없음 |
| Insight Lab 회원 탈퇴·기록 삭제 | Supabase → Authentication → Users에서 그 사용자 삭제(세션·노트·통계가 함께 삭제됨) → SQL **[B]** 에 사용자 ID를 넣어 실행 | 없음 |
| 열람 요청 | SQL Editor에서 그 이메일/사용자 ID로 해당 행 조회 후 메일로 회신 | — |

- 요청자가 본인인지는 **그 이메일 주소에서 온 요청인지**로 확인한다(구독·로그인 모두 이메일 기반).
- 처리 후 요청자에게 처리했다고 회신한다. 처리 기한은 운영자가 정한다(법정 기한은 법률 검토 항목).
- Brevo는 메일 발송만 하고 연락처 목록을 쓰지 않으므로 Brevo에서 지울 것은 없다(발송 로그는 Brevo 정책에 따름).
- 백업 파일(`%USERPROFILE%\MarkLens-backups`)에도 개인정보가 있다. 보유 기간이 지난 백업 폴더는 삭제한다.

## 정기 파기 (매월 1회)

SQL **[C]** 의 `{{...}}`를 확정한 보유 기간(일수)으로 바꿔 실행한다. 지우는 것:
- 해지 후 보유 기간이 지난 구독자
- 확인 메일을 누르지 않은 채 정해진 기간이 지난 대기 구독자
- 보유 기간이 지난 뉴스레터 발송·열람·클릭 기록, 더 이상 구독자가 아닌 주소의 기록
- 보유 기간이 지난 AI 사용량 기록(IP 해시는 사람과 연결할 수 없어 기간으로만 지운다)
- 보유 기간이 지난 의견(피드백)
