-- 뉴스레터 오픈율·클릭율 추적 (Brevo 웹훅이 기록)
-- Supabase SQL Editor에서 1회 실행.
-- Brevo 웹훅은 이미 등록됨: https://marklens.site/api/webhooks/brevo?secret=<N8N_WEBHOOK_SECRET>
--   (delivered/opened/click 이벤트 → 발송 시 부여한 issue-<id> 태그로 이슈별 집계)

create table if not exists newsletter_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid,
  email text,
  event text,                      -- delivered | opened | click ...
  created_at timestamptz default now()
);

create index if not exists idx_newsletter_events_issue on newsletter_events(issue_id);
create index if not exists idx_newsletter_events_event on newsletter_events(event);

grant all on newsletter_events to anon, authenticated, service_role;
alter table newsletter_events enable row level security;
-- 공개 정책 없음 → service_role(서버)만 접근. 웹훅·집계는 admin 클라이언트로 동작.
