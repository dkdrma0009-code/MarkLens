-- =============================================================================
-- supabase/migrations/012_insight_legacy_slug.sql
--
-- 목적   : 인사이트 슬러그를 한글 → ASCII 로 교체하면서 옛 슬러그를 보존한다.
--          한글 슬러그가 Next 암묵 캐시 태그(_N_T_/insights/<한글>)를 통해
--          x-next-cache-tags 응답 헤더(Latin1)를 깨뜨려 500 이 나므로 ASCII 로 옮기고,
--          검색에 인덱싱된 옛 URL 을 legacy_slug 로 리다이렉트/폴백한다.
--
-- 적용   : Supabase 대시보드 → SQL Editor 에 전체 붙여넣기 후 실행 (수동 운영 방식)
-- 멱등   : IF NOT EXISTS 기반, 재실행 안전.
-- 권한   : insights 는 006 grants 에서 anon SELECT 허용(테이블 단위) → 새 컬럼도 자동 읽기
--          가능하므로 별도 grant 불필요.
--
-- 작성   : 2026-08-02
-- 다음   : 마이그레이션 스크립트(Phase 2)가 slug=ASCII, legacy_slug=옛한글 로 채운다.
-- =============================================================================

ALTER TABLE insights ADD COLUMN IF NOT EXISTS legacy_slug text;

-- 옛 URL 조회(폴백/리다이렉트)용
CREATE INDEX IF NOT EXISTS insights_legacy_slug_idx ON insights (legacy_slug);
