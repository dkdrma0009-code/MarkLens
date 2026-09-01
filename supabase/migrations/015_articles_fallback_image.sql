-- =============================================================================
-- supabase/migrations/015_articles_fallback_image.sql
--
-- 목적   : 원본 image_url이 없거나(og 수집 실패) 핫링크 차단(musebyclios 등)일 때 쓸
--          Unsplash 폴백 이미지를 아티클에 저장한다. 그리드/상세 썸네일이 보라 그라디언트
--          대신 주제 관련 실사진을 보여주게 한다.
--          {url, credit, creditLink} — Unsplash 이용약관상 크레딧을 함께 보관(상세페이지 표기).
--
-- 적용   : Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
-- 멱등   : IF NOT EXISTS 기반, 재실행 안전.
-- 작성   : 2026-09-01
-- =============================================================================

alter table articles add column if not exists fallback_image jsonb;

comment on column articles.fallback_image is
  'Unsplash 폴백 이미지 {url, credit, creditLink}. 원본 image_url이 없거나 핫링크 차단일 때 썸네일용.';
