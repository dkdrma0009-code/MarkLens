-- 026: Insight Lab least privilege.
-- The production audit (2026-10-25) found `authenticated` holding every table privilege on insight_sessions,
-- insight_notes and insight_user_stats — 025's set plus UPDATE/DELETE on sessions, DELETE on stats and
-- TRUNCATE/REFERENCES/TRIGGER on all three. 004's policies cover none of the extras (sessions and stats have no
-- UPDATE/DELETE policy, so RLS refuses those today), and TRUNCATE is not subject to RLS at all. The API offers no way to
-- issue TRUNCATE, but nothing should depend on that.
-- This resets anon and authenticated on the four tables to exactly what the routes use (= 025). One transaction, so
-- the app never sees a moment without its grants. The table owner and service_role are untouched. Idempotent.
BEGIN;

REVOKE ALL ON public.insight_challenges, public.insight_sessions, public.insight_notes, public.insight_user_stats FROM anon, authenticated;

GRANT SELECT ON public.insight_challenges TO anon, authenticated;
GRANT SELECT, INSERT ON public.insight_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.insight_user_stats TO authenticated;

-- The grants are only safe while RLS is on: refuse to finish otherwise.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname IN ('insight_challenges', 'insight_sessions', 'insight_notes', 'insight_user_stats')
               AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Insight Lab tables must have row level security enabled before 026 grants access';
  END IF;
END $$;

COMMIT;

-- Rollback (separately approved) — restores what production had before 026:
-- GRANT ALL ON public.insight_sessions, public.insight_notes, public.insight_user_stats TO authenticated;
