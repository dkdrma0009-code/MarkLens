-- =============================================================================
-- supabase/migrations/014_articles_site_published.sql
--
-- 목적   : 일일 파이프라인 재편(방법 A) — 사이트 공개를 IG 발행에서 분리.
--          분석 완료(ready) 신규를 그날 사이트 published 로 전환할 때 그 시각을 기록한다.
--          site_published_at 이 설정됨 = "사이트 공개 정상 상태"(카드뉴스 IG 는 그중 하루 1건만
--          선별 발행). 이 표식으로 "published 인데 IG 안 나감 = 유령" 오해를 방지한다:
--            · site_published_at 있음 + 카드뉴스 없음  → 사이트 전용(정상, IG 선별 대상 아님)
--            · 카드뉴스 posted_at 있음                 → IG 발행됨
--            · 카드뉴스 있고 posted_at 없음 + not skipped_stale → 진짜 유령(발행 실패)
--            · 카드뉴스 publish_status='skipped_stale' → 의도적 스킵(013 이전 사고 정리분)
--
-- 적용   : Supabase 대시보드 → SQL Editor 에 붙여넣고 실행 (수동 운영 방식)
-- 멱등   : IF NOT EXISTS 기반, 재실행 안전.
-- 작성   : 2026-08-03
--
-- 참고   : 발행 스위치 app_config.site_publish_auto('on'|미설정=off)는 데이터라 여기서 안 만든다.
--          검토(dry-run) 후 SQL 로 'on' 세팅 시 collect 크론이 실제 공개를 시작한다.
-- =============================================================================

alter table articles add column if not exists site_published_at timestamptz;

create index if not exists articles_site_published_at_idx on articles (site_published_at);

comment on column articles.site_published_at is
  '일일 파이프라인 site-publish 로 사이트 공개된 시각. 설정됨 = 사이트공개 정상(IG는 선별 1건). 유령(발행실패) 판별과 구분.';
