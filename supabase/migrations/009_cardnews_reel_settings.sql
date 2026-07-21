-- cardnews.reel_settings — 릴스컷 연출 설정 + 비전이 고른 사진을 기사별로 고정
--
-- 릴스는 장면마다 사진·자막위치·줌·길이가 다르고, 사진은 매번 Unsplash 를 새로
-- 조회하면 다른 게 나온다. 마음에 드는 결과가 나왔을 때 그대로 굳혀두기 위한 컬럼.
--
-- 구조 (jsonb):
--   {
--     "settings": { layout, slideTypes, slideSeconds, ctaSeconds, kenBurns,
--                   scrim, credit, creditSeconds, shots: { <slideType>: {...} } },
--     "photos":   { "<slideType>": { "url": "...", "credit": "..." } },
--     "savedAt":  "2026-07-20T10:00:00.000Z"
--   }
--
-- NULL = 저장된 적 없음 → 미리보기가 비전 판단으로 새로 채운다.
--
-- Supabase SQL Editor에서 1회 실행. 재실행해도 안전.

ALTER TABLE cardnews
  ADD COLUMN IF NOT EXISTS reel_settings jsonb;

COMMENT ON COLUMN cardnews.reel_settings IS
  '릴스컷 연출 설정 + 확정된 사진. NULL이면 열 때마다 비전이 새로 판단한다.';
