-- newsletter_issues.approved_at 컬럼 추가
--
-- 배경: 앱 코드(send 라우트의 발송 후 상태 업데이트, 어드민 "승인 대기" 쿼리,
--       뉴스레터 관리 화면의 StatusBadge/Controls)는 approved_at 컬럼이 존재한다고
--       가정하지만, 어떤 마이그레이션에도 정의가 없어 실제 DB에 빠져 있었다.
--       그 결과 send 라우트의 UPDATE({status, sent_at, approved_at})가 통째로 실패해,
--       발송이 나가도 이슈가 draft로 남고 대시보드 승인-대기 쿼리도 깨졌다.
--
-- 승인 워크플로: draft(approved_at NULL) → 승인(approved_at 설정) → 발송(status=sent).
--
-- Supabase SQL Editor에서 1회 실행. 재실행해도 안전(IF NOT EXISTS).

ALTER TABLE newsletter_issues
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;
