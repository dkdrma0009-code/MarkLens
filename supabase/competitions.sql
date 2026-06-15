-- MarkLens — 공모전·대외활동 시스템 (기존 articles/rss_sources 패턴 복제)
-- Supabase SQL Editor에서 1회 실행. 기존 schema.sql 스타일·관례를 그대로 따름.

-- 1. Competition Sources (수집 소스 — rss_sources 패턴)
CREATE TABLE IF NOT EXISTS competition_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                       -- '위비티', '링커리어' 등
  slug TEXT UNIQUE NOT NULL,
  source_url TEXT NOT NULL,                 -- RSS 피드 URL 또는 목록 페이지 URL
  collect_type TEXT NOT NULL DEFAULT 'rss', -- 'rss' | 'scrape' (수집 방식)
  is_active BOOLEAN DEFAULT TRUE,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Competitions (수집 + LLM 분류 결과 — articles + insights를 한 테이블에)
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  organizer TEXT,                           -- 주최
  source_url TEXT UNIQUE NOT NULL,          -- 원문 링크 (중복 방지 unique — articles.url 패턴)
  source_name TEXT NOT NULL,                -- 위비티/인크루트/링커리어 등
  thumbnail_url TEXT,
  description TEXT,                          -- LLM 생성 요약
  category TEXT,                            -- 공모전/대외활동/서포터즈/기타
  deadline DATE,                            -- 마감일
  start_date DATE,
  prize TEXT,                               -- 시상 규모
  eligibility TEXT,                         -- 지원 자격

  -- LLM 분류 결과 (1차)
  job_fit JSONB DEFAULT '[]',               -- ["콘텐츠기획","퍼포먼스",...] 다중
  difficulty TEXT,                          -- 하|중|상 (준비 난이도)
  -- priority(red/orange/yellow/green)는 저장하지 않고 deadline 기반 동적 계산
  -- (마감일은 매일 가까워지므로 정적 저장 시 부정확 — src/lib/competitions/priority.ts)

  -- 2차 확장용 (이번엔 컬럼만, 로직 미구현)
  matched_article_ids JSONB DEFAULT '[]',   -- 2차: 캠페인·아티클 매칭
  past_winner_analysis TEXT,                -- 2차: 수상작 분석

  -- 운영 (기존 articles status 패턴)
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | published | rejected | expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (articles 패턴)
CREATE INDEX IF NOT EXISTS idx_competitions_status ON competitions(status);
CREATE INDEX IF NOT EXISTS idx_competitions_deadline ON competitions(deadline);
CREATE INDEX IF NOT EXISTS idx_competitions_category ON competitions(category);

-- updated_at 자동 갱신 (기존 update_updated_at() 함수 재사용)
DROP TRIGGER IF EXISTS competitions_updated_at ON competitions;
CREATE TRIGGER competitions_updated_at BEFORE UPDATE ON competitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Grants (기존 관례)
GRANT ALL ON competition_sources, competitions TO anon, authenticated, service_role;

-- RLS (insights/articles 패턴 — published만 공개 읽기)
ALTER TABLE competition_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published competitions" ON competitions;
CREATE POLICY "Public can read published competitions" ON competitions
  FOR SELECT USING (status = 'published');

-- 수집 소스 시드는 2단계(수집 방식 확정 후) — RSS 제공 여부·robots.txt 확인 뒤 INSERT
-- 예시:
-- INSERT INTO competition_sources (name, slug, source_url, collect_type) VALUES
--   ('위비티', 'wevity', 'https://...', 'scrape');
