-- PREVIEW / LOCAL ONLY — never run against production.
-- Brings a fresh Preview database to production's end state where the repository cannot replay production's history
-- (R-3 B: describe-unmanaged-schema.sql run on production, 2026-10-24). Runs after every migration.
BEGIN;

-- 006 grants on competitions, so 001a creates it; production no longer has the table (the feature was removed and
-- /competitions redirects to /insights).
DROP TABLE IF EXISTS public.competitions;

-- Production's random_quiz carries no EXECUTE grants for anon/authenticated/service_role (PUBLIC only). Here 005, and in a
-- fresh Supabase project its default privileges, add them; take them back.
REVOKE ALL ON FUNCTION public.random_quiz(text, text, integer) FROM anon, authenticated, service_role;

-- Storage buckets production has, all public. cardnews-ig is also created on demand by the code.
INSERT INTO storage.buckets (id, name, public) VALUES
  ('ad-assets', 'ad-assets', true),
  ('ad-clips', 'ad-clips', true),
  ('cardnews-ig', 'cardnews-ig', true),
  ('stock-posters', 'stock-posters', true)
ON CONFLICT (id) DO NOTHING;

COMMIT;
