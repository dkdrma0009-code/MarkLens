-- =============================================================================
-- supabase/migrations/010_content_metrics.sql
--
-- 목적   : 피드백 루프용 성과 저장 테이블. 발행된 콘텐츠(인사이트/카드뉴스/큐레이션/
--          릴스)의 인스타·스레드 게시물 지표를 게시물 단위로 담는다.
--          upsert 로 같은 게시물은 최신값으로 덮인다(시계열 아님 — 현재 스냅샷 1행).
--
-- 적용   : Supabase 대시보드 → SQL Editor에 전체 붙여넣기 후 실행 (수동 운영 방식)
-- 의존   : 005/006(권한 스윕) 이후. service_role 전용 — anon/authenticated 비공개.
-- 멱등   : IF NOT EXISTS 기반, 재실행 안전.
--
-- 작성   : 2026-07-29
-- 다음   : 적재 로직(ig-daily 등에서 getMediaInsight → 이 테이블 upsert)은 별도 단계.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 테이블
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_metrics (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 콘텐츠 연결
  content_type       text NOT NULL CHECK (content_type IN ('insight', 'cardnews', 'curation', 'reel')),
  content_id         text NOT NULL,  -- 원본 식별자(article_id UUID / 큐레이션 id 등 혼용 → text)
  ig_post_id         text NOT NULL,  -- 게시물 ID (지표 조회 키)
  platform           text NOT NULL CHECK (platform IN ('instagram', 'threads')),

  -- 지표 (조회 실패분은 0)
  reach              integer NOT NULL DEFAULT 0,
  likes              integer NOT NULL DEFAULT 0,
  saved              integer NOT NULL DEFAULT 0,
  shares             integer NOT NULL DEFAULT 0,
  comments           integer NOT NULL DEFAULT 0,
  followers_at_time  integer,        -- 스냅샷 시점 계정 팔로워 수(정규화용, 없을 수 있음)

  -- 메타
  posted_at          timestamptz,    -- 게시물 발행 시각(최근 N일 필터용)
  recorded_at        timestamptz NOT NULL DEFAULT now(),

  -- 같은 게시물은 한 행으로 유지 → upsert 시 최신값으로 덮임
  CONSTRAINT content_metrics_post_uniq UNIQUE (ig_post_id, platform)
);

-- -----------------------------------------------------------------------------
-- 인덱스
-- -----------------------------------------------------------------------------
-- "어떤 콘텐츠가 어떤 성과냈나" 조회
CREATE INDEX IF NOT EXISTS content_metrics_content_idx
  ON content_metrics (content_type, content_id);

-- 최근 14일 등 발행일 범위 조회
CREATE INDEX IF NOT EXISTS content_metrics_posted_at_idx
  ON content_metrics (posted_at DESC);

-- -----------------------------------------------------------------------------
-- 권한/RLS — follower_snapshots 등과 동일 패턴(service_role 전용)
--
-- 006_grants_tighten.sql 이 anon/authenticated 의 신규 테이블 기본 권한을 회수했으므로
-- 이 테이블은 별도 GRANT 없이는 두 롤에 비공개다. 적재/조회는 전부 service_role
-- (createAdminClient / 크론)로만 이뤄진다. RLS 를 켜 정책 없이 두면(=deny) 방어가 이중화되고
-- service_role 은 RLS 를 우회하므로 정상 동작한다.
-- -----------------------------------------------------------------------------
ALTER TABLE content_metrics ENABLE ROW LEVEL SECURITY;

-- service_role 명시적 부여(005 의 기본 부여와 대칭 — 명시로 안전하게)
GRANT ALL ON content_metrics TO service_role;

-- anon / authenticated 에는 부여하지 않는다(의도적으로 비공개).
