-- =============================================================================
-- supabase/migrations/013_subscribers_source.sql
--
-- 목적   : subscribers 에 source(유입 경로) 컬럼 추가.
--          /api/subscribe 는 커밋 994a112(2026-06-17)부터 구독 시 source 값을
--          넣으려 했으나 컬럼이 없어 upsert 가 400(PGRST204)로 실패 → 그 이후
--          사이트 구독이 조용히 전멸(2026-06-15 이후 신규 0). 컬럼을 추가해 복구한다.
--
-- 적용   : Supabase 대시보드 → SQL Editor 에 붙여넣고 실행 (수동 운영 방식)
-- 멱등   : IF NOT EXISTS 기반, 재실행 안전.
-- 권한   : subscribers 는 서버(service_role)만 접근 → 별도 grant 불필요.
--
-- 작성   : 2026-08-03
-- 관련   : 코드 쪽은 /api/subscribe 가 upsert 실패 시 success 를 반환하지 않도록 함께 수정.
-- =============================================================================

alter table subscribers add column if not exists source text;

comment on column subscribers.source is
  '구독 유입 경로(폼 위치): insight_bottom / insight_mid / home_inline / newsletter_page 등. 최초 구독 시만 기록.';

-- 확인
select column_name, data_type
from information_schema.columns
where table_name = 'subscribers' and column_name = 'source';
