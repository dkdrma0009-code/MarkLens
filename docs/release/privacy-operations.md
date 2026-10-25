# 개인정보 요청 처리와 정기 파기 (개인 운영)

보관 기준(2026-10-25 운영자 확정)은 [`src/lib/privacy/retention.ts`](../../src/lib/privacy/retention.ts) 한 곳에 있고, 처리방침 문구·자동 정리·운영자 SQL이 모두 이 값을 따른다(`tests/privacy-retention.test.mjs`).

| 대상 | 기준 | 지키는 방법 |
|---|---|---|
| 구독 해지 | 즉시 삭제 | 해지 링크(`/api/unsubscribe`)가 구독 정보와 그 주소의 발송 기록을 바로 삭제 |
| 이메일 확인 미완료 구독 | 7일 | 매일 자동 정리 |
| 뉴스레터 발송·열람·클릭 기록 | 90일(구독자가 아닌 주소는 바로) | 매일 자동 정리 |
| AI 사용량 기록 | 90일 | 매일 자동 정리 |
| 의견(피드백) | 접수 후 6개월(183일). 의견은 접수 즉시 운영자 메일로 전달돼 그때 처리되므로 접수 시점 기준 | 매일 자동 정리 |
| Insight Lab 회원 | 탈퇴(계정 삭제) 시 즉시 | 요청 처리 [B] — 계정 삭제 시 기록이 함께 삭제 |
| 운영자 백업 파일 | 만든 날부터 90일 | 월 1회 확인 때 삭제 |
| 개인정보 문의 메일(네이버 메일함) | 처리 완료 후 6개월(의견과 같은 기준) | 월 1회 확인 때 삭제 — 아래 "문의 메일 정리" |
| ImprovMX 전달 기록 | 7일(ImprovMX 기본값) | ImprovMX가 자동 삭제. 전달된 메일 본문은 전달 후 ImprovMX에서 삭제 |

## 매일 자동 정리

`/api/cron/privacy-purge`가 매일 03:30(KST) 위 기준을 넘은 기록을 지운다. 실패하면 운영자 메일로 알림이 온다. 같은 규칙을 손으로 돌리는 SQL은 [`scripts/release/privacy-deletion.sql`](../../scripts/release/privacy-deletion.sql)의 **[C]**.

- **첫 실행 주의**: 운영 DB에는 이메일 확인을 마치지 않은 구독 신청 2건이 있다(2026-10-25 점검). 7일이 지났다면 배포 후 첫 실행에서 삭제된다 — 확정된 기준대로의 동작이다.

## 월 1회 운영자 확인

1. Vercel → 프로젝트 → Logs에서 `privacy-purge` 실행 결과(삭제 건수)가 매일 있는지 본다. 빠진 날이 있으면 SQL **[C]** 를 실행한다.
2. `%USERPROFILE%\MarkLens-backups`에서 90일이 지난 백업 폴더를 삭제한다.
3. 지난달 처리하지 못한 요청이 없는지 문의 메일함을 확인한다.
4. **문의 메일 정리**(네이버 메일):
   - 받는 메일함에서 받는 사람이 `newsletter@marklens.site`인 메일에 `MarkLens 문의` 라벨을 붙여 둔다(네이버 메일 필터로 자동 분류해 두면 편하다).
   - 답변·처리를 마친 메일은 처리 완료일을 기준으로, **6개월이 지난 것**을 `MarkLens 문의`에서 골라 삭제하고 **휴지통에서도 삭제**한다. 답장으로 보낸 메일(보낸메일함)도 같이 지운다.
   - 법령상 따로 남겨야 하는 문의(예: 분쟁·수사기관 요청)가 생기면 근거와 기간을 메모해 이 정리에서 제외한다. 지금은 해당 없음.

## 요청 처리 — 정기 정리를 기다리지 않고 바로

| 요청 | 할 일 |
|---|---|
| 뉴스레터 해지 | 메일 하단 해지 링크(자동, 즉시 삭제). 메일로 요청하면 SQL **[A]** |
| 구독 정보 삭제 | SQL **[A]** 에 그 이메일 |
| Insight Lab 탈퇴·기록 삭제 | Supabase → Authentication → Users에서 그 사용자 삭제 → SQL **[B]** 에 사용자 ID |
| 열람 요청 | SQL Editor에서 그 이메일/사용자 ID의 행을 조회해 회신 |

- 본인 확인: 그 이메일 주소에서 온 요청인지로 확인한다(구독·로그인 모두 이메일 기반).
- 처리 후 요청자에게 회신한다. 법은 "지체 없이"를 요구한다(법 제21조). 개인정보 포털의 처리방침 예시는 5일 이내를 쓴다.
- Brevo는 메일 발송만 하고 연락처 목록을 쓰지 않으므로 Brevo에서 지울 것은 없다(발송 로그는 Brevo 정책에 따름).

## 문의 메일 받기 — newsletter@marklens.site → 네이버 관리자 메일

**설정 완료(2026-10-25)**: ImprovMX 도메인 상태 Forwarding 정상, MX 2개(`mx1/mx2.improvmx.com`)와 SPF 1개(`include:spf.improvmx.com include:spf.brevo.com`), Brevo 인증(brevo-code·DKIM·DMARC) 유지. 시험 메일: ImprovMX에서 DELIVERED, 네이버 메일 서버가 250 OK로 수신. **네이버 받은편지함에 실제로 표시되는지는 확인하지 못했다** — 첫 실제 문의 때 받은편지함·스팸함을 확인한다.

아래는 설정 당시의 절차 기록이다. 설정 전에는 `marklens.site`에 MX 레코드가 없어 이 주소로 오는 메일이 **어디에도 도착하지 않았다**. DNS는 가비아(`ns.gabia.co.kr`)가 관리한다. 새 메일 계정 없이 전달만 하는 방법:

1. **ImprovMX**(무료 전달 서비스)에 가입하고 도메인 `marklens.site`, 별칭 `newsletter` → 네이버 관리자 주소를 등록한다.
2. **가비아 → My가비아 → DNS 관리툴**에서 `marklens.site`에 추가(기존 레코드는 지우지 않는다 — 웹사이트 A 레코드, Brevo 인증 TXT·DKIM·DMARC 유지):
   - MX `@` → `mx1.improvmx.com.` 우선순위 10
   - MX `@` → `mx2.improvmx.com.` 우선순위 20
   - TXT `@` → `v=spf1 include:spf.improvmx.com include:spf.brevo.com ~all` (지금 SPF 레코드가 없다. Brevo 발송은 DKIM으로 인증되지만 함께 넣어 둔다. SPF는 도메인당 하나만)
3. 반영 확인(운영자 작업 없이 확인 가능): `marklens.site`의 MX가 위 두 값으로 보이는지.
4. **수신 시험**: 다른 메일 계정에서 `newsletter@marklens.site`로 시험 메일을 보내 네이버 관리자 메일에 도착하는지 확인한다. 도착하면 `PRIVACY_FACTS.contactInboxVerified = true`.
5. 뉴스레터·구독 확인·온보딩 메일의 회신 주소는 이미 `newsletter@marklens.site`로 설정돼 있다(`mailReplyTo()`) — 전달이 켜지면 회신도 네이버로 간다.

가비아 자체 메일 전달 기능의 조건은 공식 자료로 확인하지 못했다. 가비아 기능을 쓰게 되면 위 1·2 대신 그 안내를 따른다.
