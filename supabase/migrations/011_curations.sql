-- =============================================================================
-- supabase/migrations/011_curations.sql
--
-- 목적   : 주간 트렌드 큐레이션(7장) 저장소. 기존 cardnews(article_id 키, 6장)와
--          완전히 별개 — 큐레이션은 인사이트 여러 개를 묶은 집계물이라 article_id 로
--          식별할 수 없어 자체 id(uuid)로 관리한다.
--          (curation-types.ts 의 CurationCardnews 를 담는 그릇. 렌더/발행/크론은 다음 단계.)
--
-- 적용   : Supabase 대시보드 → SQL Editor에 전체 붙여넣기 후 실행 (수동 운영 방식)
-- 의존   : 005/006(권한 스윕) 이후. service_role 전용 — anon/authenticated 비공개.
-- 멱등   : IF NOT EXISTS 기반, 재실행 안전.
--
-- 작성   : 2026-07-29
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 테이블
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS curations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  kind         text NOT NULL DEFAULT 'weekly-trend',  -- 큐레이션 종류(확장 대비: monthly 등)
  week_of      date,                                  -- 그 주 기준일(nullable)

  slides       jsonb NOT NULL,   -- CurationCardnews.slides — intro 1 + trend 5 + outro 1 (7장)
  caption      text,             -- 인스타 캡션(생성 단계에서 채움)

  ig_post_id   text,             -- 발행 후 기록
  posted_at    timestamptz,      -- 발행 후 기록

  performance  jsonb,            -- 피드백 루프 자리 — 지금은 비움

  created_at   timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 인덱스
-- -----------------------------------------------------------------------------
-- 최신 큐레이션 조회
CREATE INDEX IF NOT EXISTS curations_created_at_idx
  ON curations (created_at DESC);

-- 발행분 조회
CREATE INDEX IF NOT EXISTS curations_posted_at_idx
  ON curations (posted_at DESC);

-- -----------------------------------------------------------------------------
-- 권한/RLS — content_metrics · follower_snapshots 와 동일 패턴(service_role 전용)
--
-- 006_grants_tighten.sql 이 anon/authenticated 의 신규 테이블 기본 권한을 회수했으므로
-- 이 테이블은 별도 GRANT 없이는 두 롤에 비공개다. 생성/발행/조회는 전부 service_role
-- (createAdminClient / 크론)로만 이뤄진다. RLS 를 켜 정책 없이 두면(=deny) 이중 방어가 되고
-- service_role 은 RLS 를 우회하므로 정상 동작한다.
-- -----------------------------------------------------------------------------
ALTER TABLE curations ENABLE ROW LEVEL SECURITY;

GRANT ALL ON curations TO service_role;

-- anon / authenticated 에는 부여하지 않는다(의도적으로 비공개).
