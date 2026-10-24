-- PREVIEW / LOCAL ONLY — never run against production (these tables already exist there).
-- Tables and the one RPC that production has but no repository migration creates (they were made in the Supabase
-- dashboard). Definitions are INFERRED FROM CODE USAGE (R-3), not copied from production; confirm or correct them with
-- scripts/release/describe-unmanaged-schema.sql (read-only) before relying on a Preview built from this file.
-- Apply after 001_schema.sql and before 002 (006 grants on feedback/competitions, 009 alters cardnews).
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
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- one card news per article; upserts rely on article_id being the conflict target (no onConflict given)
CREATE TABLE IF NOT EXISTS public.cardnews (
  article_id uuid PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
  slides jsonb,
  category text,
  caption text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz,
  posted_at timestamptz,
  reels_posted_at timestamptz,
  ig_post_id text,
  publish_status text
);

-- reader feedback on an insight; inserted through the anon/user client (006: "RLS ON, INSERT only, anon")
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid REFERENCES public.insights(id) ON DELETE CASCADE,
  rating text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'feedback_insert') THEN
    CREATE POLICY feedback_insert ON public.feedback FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;

-- daily follower counts written by the ig-daily cron; read ordered by recorded_at and by created_at
CREATE TABLE IF NOT EXISTS public.follower_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  followers integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trend Quiz pool: rows { level, type, data } from learn/seed; read through random_quiz()
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  type text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- /feedback site survey (rating 1–5 validated in the route)
CREATE TABLE IF NOT EXISTS public.site_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating integer NOT NULL,
  liked text,
  disliked text,
  role text,
  will_subscribe text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- legacy table that 006 grants on; current code never reads it. Columns unknown — placeholder only.
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

-- learn/generate: supabase.rpc("random_quiz", { p_level, p_type, p_count }) → rows { data } (p_type null = any type)
CREATE OR REPLACE FUNCTION public.random_quiz(p_level text, p_type text, p_count integer)
RETURNS TABLE(data jsonb)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT q.data FROM public.quiz_questions q
  WHERE q.level = p_level AND (p_type IS NULL OR q.type = p_type)
  ORDER BY random() LIMIT greatest(p_count, 0)
$$;

COMMIT;
