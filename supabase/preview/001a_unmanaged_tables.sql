-- PREVIEW / LOCAL ONLY — never run against production (these tables already exist there).
-- Tables and the one RPC that production has but no repository migration creates (they were made in the Supabase
-- dashboard). Definitions MATCH PRODUCTION as read with scripts/release/describe-unmanaged-schema.sql (R-3 B,
-- 2026-10-24): columns, types, nullability, defaults, keys, checks, indexes, RLS and the policy. The two masked literals
-- of the feedback policy are the ratings the API accepts (src/app/api/feedback/route.ts).
-- Apply after 001_schema.sql and before 002 (006 grants on feedback/competitions, 009 alters cardnews).
-- supabase/preview/950_production_parity.sql then removes what production no longer has.
BEGIN;

-- insights columns the analysis pipeline writes (analyzeArticle result is upserted as is) and the pages read
ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS hook text,
  ADD COLUMN IF NOT EXISTS marketing_terms jsonb,
  ADD COLUMN IF NOT EXISTS quiz jsonb,
  ADD COLUMN IF NOT EXISTS video_url text;

-- key/value flags and rotated tokens: ig_auto_publish, site_publish_auto, curation_auto_publish, ig/threads tokens
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- one card news per article; upserts rely on article_id being the conflict target (no onConflict given)
CREATE TABLE IF NOT EXISTS public.cardnews (
  article_id uuid PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
  slides jsonb NOT NULL,
  category text,
  caption text,
  updated_at timestamptz DEFAULT now(),
  scheduled_at timestamptz,
  posted_at timestamptz,
  reels_posted_at timestamptz,
  ig_post_id text,
  publish_status text
);

-- reader feedback on an insight; anon may insert a rated row for an insight, nothing else (no read, no update)
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid REFERENCES public.insights(id) ON DELETE CASCADE,
  rating text NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'anon_can_insert_feedback') THEN
    CREATE POLICY anon_can_insert_feedback ON public.feedback FOR INSERT TO anon
      WITH CHECK (insight_id IS NOT NULL AND rating IN ('helpful', 'not_helpful'));
  END IF;
END $$;

-- daily follower counts written by the ig-daily cron; read newest first by recorded_at
CREATE TABLE IF NOT EXISTS public.follower_snapshots (
  id bigserial PRIMARY KEY,
  platform text NOT NULL CHECK (platform IN ('instagram', 'threads')),
  followers integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS follower_snapshots_platform_recorded_at_idx ON public.follower_snapshots (platform, recorded_at DESC);

-- Trend Quiz pool: rows { level, type, data } from learn/seed; read through random_quiz()
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  type text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quiz_level_type ON public.quiz_questions (level, type);

-- /feedback site survey (rating 1–5 validated in the route)
CREATE TABLE IF NOT EXISTS public.site_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating integer NOT NULL,
  liked text,
  disliked text,
  role text,
  will_subscribe text,
  created_at timestamptz DEFAULT now()
);

-- legacy table that 006 grants on, so it must exist when 006 runs; production has since dropped it
-- (950_production_parity.sql drops it here too). Columns unknown — placeholder only.
CREATE TABLE IF NOT EXISTS public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cardnews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follower_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

-- learn/generate (service role): supabase.rpc("random_quiz", { p_level, p_type, p_count }); p_type null = any type.
-- Body as in production.
CREATE OR REPLACE FUNCTION public.random_quiz(p_level text, p_type text, p_count integer)
RETURNS SETOF public.quiz_questions
LANGUAGE sql STABLE AS $$SELECT * FROM quiz_questions WHERE level = p_level AND (p_type IS NULL OR type = p_type) ORDER BY random() LIMIT p_count;$$;

COMMIT;
