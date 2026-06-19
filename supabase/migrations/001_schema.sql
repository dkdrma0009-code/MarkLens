-- MarkLens Database Schema

-- 1. Articles (수집된 원본 아티클)
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL, -- 'hubspot', 'ahrefs', 'semrush' 등
  source_name TEXT NOT NULL, -- 'HubSpot Blog', 'Ahrefs Blog' 등
  author TEXT,
  published_at TIMESTAMPTZ,
  raw_content TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'analyzing' | 'ready' | 'published' | 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insights (AI 분석 결과)
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID UNIQUE REFERENCES articles(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  summary TEXT, -- 핵심 요약
  key_takeaways TEXT[], -- 이것만 기억하세요
  why_it_matters TEXT, -- 왜 중요한가
  practical_applications TEXT, -- 실전 적용법
  framework_analysis TEXT, -- 프레임워크 분석
  portfolio_usage TEXT, -- 포트폴리오 활용
  interview_points TEXT[], -- 면접에서 써먹기
  category TEXT NOT NULL, -- 카테고리
  tags TEXT[], -- 태그
  keywords TEXT[], -- 검색 키워드
  is_featured BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  article_count INTEGER DEFAULT 0
);

-- 기본 카테고리 삽입
INSERT INTO categories (name, slug, description) VALUES
  ('브랜딩', 'branding', '브랜드 전략과 정체성'),
  ('퍼포먼스 마케팅', 'performance-marketing', '광고, CPC, ROAS 등'),
  ('CRM', 'crm', '고객 관계 관리'),
  ('콘텐츠 마케팅', 'content-marketing', '콘텐츠 전략과 제작'),
  ('SEO', 'seo', '검색엔진 최적화'),
  ('소셜 미디어', 'social-media', '소셜 미디어 전략'),
  ('AI 마케팅', 'ai-marketing', 'AI를 활용한 마케팅'),
  ('소비자 심리', 'consumer-psychology', '소비자 행동과 심리');

-- 4. Newsletter Issues (뉴스레터 호)
CREATE TABLE newsletter_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_number INTEGER UNIQUE NOT NULL,
  title TEXT NOT NULL,
  week_signals TEXT, -- This Week's Signals
  case_of_week TEXT, -- Case of the Week
  ai_brief TEXT, -- AI Marketing Brief
  portfolio_insight TEXT, -- Portfolio Insight
  career_lens TEXT, -- Career Lens
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'ready' | 'sent'
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  open_rate DECIMAL,
  click_rate DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Subscribers (구독자)
CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'unsubscribed'
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

-- 6. RSS Sources (수집 소스)
CREATE TABLE rss_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  rss_url TEXT NOT NULL,
  website_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_fetched_at TIMESTAMPTZ,
  article_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 RSS 소스 삽입
INSERT INTO rss_sources (name, slug, rss_url, website_url) VALUES
  ('HubSpot Blog', 'hubspot', 'https://blog.hubspot.com/marketing/rss.xml', 'https://blog.hubspot.com/marketing'),
  ('Ahrefs Blog', 'ahrefs', 'https://ahrefs.com/blog/feed/', 'https://ahrefs.com/blog'),
  ('Semrush Blog', 'semrush', 'https://www.semrush.com/blog/feed/', 'https://www.semrush.com/blog'),
  ('Neil Patel', 'neil-patel', 'https://neilpatel.com/blog/feed/', 'https://neilpatel.com/blog'),
  ('Think with Google', 'think-with-google', 'https://www.thinkwithgoogle.com/feed/', 'https://www.thinkwithgoogle.com');

-- 7. Analytics Events
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'article_view', 'newsletter_open', 'subscribe' 등
  article_id UUID REFERENCES articles(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_source ON articles(source);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_insights_category ON insights(category);
CREATE INDEX idx_insights_slug ON insights(slug);
CREATE INDEX idx_insights_is_featured ON insights(is_featured);
CREATE INDEX idx_subscribers_status ON subscribers(status);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);

-- Updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER insights_updated_at BEFORE UPDATE ON insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER newsletter_issues_updated_at BEFORE UPDATE ON newsletter_issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Grants (PostgREST 접근용)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- RLS Policies
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 (published 상태만)
CREATE POLICY "Public can read published insights" ON insights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM articles WHERE articles.id = insights.article_id AND articles.status = 'published'
    )
  );

CREATE POLICY "Public can read categories" ON categories
  FOR SELECT USING (TRUE);

CREATE POLICY "Public can read published articles" ON articles
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public can read sent newsletters" ON newsletter_issues
  FOR SELECT USING (status = 'sent');

-- 구독자 본인 데이터만
CREATE POLICY "Anyone can subscribe" ON subscribers
  FOR INSERT WITH CHECK (TRUE);

-- analytics insert
CREATE POLICY "Anyone can insert events" ON analytics_events
  FOR INSERT WITH CHECK (TRUE);
