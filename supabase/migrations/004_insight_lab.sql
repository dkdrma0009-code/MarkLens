-- MarkLens 인사이트 분석 학습 시스템
-- Supabase SQL Editor에서 실행

-- 1. 오늘의 챌린지 테이블
CREATE TABLE IF NOT EXISTS insight_challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  summary      text NOT NULL,
  category     text NOT NULL DEFAULT '마케팅',
  difficulty   text NOT NULL DEFAULT '보통' CHECK (difficulty IN ('쉬움', '보통', '어려움')),
  source_url   text,
  source_name  text DEFAULT 'MarkLens',
  published_date date NOT NULL DEFAULT CURRENT_DATE,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- 2. 분석 세션 테이블
CREATE TABLE IF NOT EXISTS insight_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id        uuid REFERENCES insight_challenges(id),
  custom_article_text text,
  step1_observation   text NOT NULL DEFAULT '',
  step2_cause         text NOT NULL DEFAULT '',
  step3_desire        text NOT NULL DEFAULT '',
  step4_insight       text NOT NULL DEFAULT '',
  step5_opportunity   text NOT NULL DEFAULT '',
  -- 꺾기 단계 답변
  step4_linear        text DEFAULT '',   -- 직선 첫 반응
  step4_reframed      text DEFAULT '',   -- 꺾은 인사이트
  -- 핵심 2축 점수 (1-5)
  score_cliche        smallint CHECK (score_cliche BETWEEN 1 AND 5),
  score_pivot         smallint CHECK (score_pivot BETWEEN 1 AND 5),
  -- 보조 4축 점수 (0-100)
  score_observation   smallint CHECK (score_observation BETWEEN 0 AND 100),
  score_analysis      smallint CHECK (score_analysis BETWEEN 0 AND 100),
  score_insight       smallint CHECK (score_insight BETWEEN 0 AND 100),
  score_strategy      smallint CHECK (score_strategy BETWEEN 0 AND 100),
  ai_feedback         jsonb,
  xp_earned           smallint DEFAULT 0,
  is_featured         boolean DEFAULT false,  -- 우수 답안 노출용 (향후 확장)
  created_at          timestamptz DEFAULT now()
);

-- 3. 인사이트 노트 테이블
CREATE TABLE IF NOT EXISTS insight_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  observation  text DEFAULT '',
  cause        text DEFAULT '',
  desire       text DEFAULT '',
  insight      text DEFAULT '',
  opportunity  text DEFAULT '',
  tags         text[] DEFAULT '{}',
  category     text DEFAULT '',
  source_label text DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- 4. 사용자 통계 테이블
CREATE TABLE IF NOT EXISTS insight_user_stats (
  user_id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_sessions        integer DEFAULT 0,
  total_xp              integer DEFAULT 0,
  streak_days           integer DEFAULT 0,
  last_activity_date    date,
  avg_score_observation numeric(5,2) DEFAULT 0,
  avg_score_analysis    numeric(5,2) DEFAULT 0,
  avg_score_insight     numeric(5,2) DEFAULT 0,
  avg_score_strategy    numeric(5,2) DEFAULT 0,
  updated_at            timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE insight_challenges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_user_stats   ENABLE ROW LEVEL SECURITY;

-- 챌린지는 누구나 읽기 가능
CREATE POLICY "challenges_public_read" ON insight_challenges
  FOR SELECT USING (active = true);

-- 세션: 본인만
CREATE POLICY "sessions_own_select" ON insight_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sessions_own_insert" ON insight_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 노트: 본인만
CREATE POLICY "notes_own_select" ON insight_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notes_own_insert" ON insight_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_own_update" ON insight_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notes_own_delete" ON insight_notes FOR DELETE USING (auth.uid() = user_id);

-- 통계: 본인만
CREATE POLICY "stats_own_select" ON insight_user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "stats_own_upsert" ON insight_user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stats_own_update" ON insight_user_stats FOR UPDATE USING (auth.uid() = user_id);

-- 샘플 챌린지 3개
INSERT INTO insight_challenges (title, summary, category, difficulty, source_name) VALUES
(
  'MZ세대가 명품 대신 빈티지를 선택하는 이유',
  'MZ세대 사이에서 명품 신상품 대신 빈티지·중고 명품 구매가 급증하고 있다. 2024년 국내 중고 명품 거래액은 전년 대비 43% 증가했으며, 20대가 전체 구매자의 38%를 차지했다. 특히 "원본성"과 "지속가능성"을 이유로 꼽는 비율이 높았다.',
  '소비자 트렌드', '보통', 'MarkLens'
),
(
  '숏폼 광고의 역설 — 짧을수록 기억에 오래 남는다',
  '15초 이하 숏폼 광고의 브랜드 회상률이 60초 광고보다 평균 22% 높다는 연구 결과가 나왔다. 단, 핵심 메시지가 처음 3초 안에 전달될 때만 해당 효과가 나타났다. 광고 업계는 이를 "임팩트 압축 효과"라고 부른다.',
  '광고 전략', '쉬움', 'MarkLens'
),
(
  '무알코올 음료 시장, 40대 직장인 남성까지 확장',
  '국내 무알코올 음료 시장이 5년 만에 8배 성장했다. 초기 임신부·운전자 중심에서 벗어나, "소버 큐리어스(Sober Curious)" 트렌드로 건강을 이유로 술을 줄이는 40대 남성 구매가 급증하고 있다. 프리미엄 무알코올 맥주 신제품 출시도 잇따른다.',
  'FMCG', '어려움', 'MarkLens'
)
ON CONFLICT DO NOTHING;
