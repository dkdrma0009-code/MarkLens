-- 025: Insight Lab table access for the roles its routes actually use (R-4).
-- Every Insight Lab route (challenge, evaluate, notes, stats, the /insight-lab page) talks to Supabase with the visitor's
-- own session: anon for visitors, authenticated for signed-in members — never service_role. 004 created own-row RLS
-- policies, but 006 then revoked every table grant from anon/authenticated, so the policies never ran: each read and
-- write failed with 42501 (reproduced on the Preview database, 2026-10-25). The evaluate route ignored the failed
-- insert, so a member got AI feedback while nothing was saved.
--
-- Grants are exactly what the routes do. Row access stays with 004's policies:
--   insight_challenges  SELECT, anon + authenticated   challenges_public_read: active = true (drafts stay hidden)
--   insight_sessions    SELECT, INSERT, authenticated  sessions_own_*: auth.uid() = user_id
--   insight_notes       SELECT, INSERT, UPDATE, DELETE sessions-style own policies (notes_own_*)
--   insight_user_stats  SELECT, INSERT, UPDATE         stats_own_*
-- anon gets nothing on the member tables; nobody gets TRUNCATE/REFERENCES/TRIGGER; RLS stays enabled.
-- Additive and idempotent (GRANT is). Rollback: the REVOKE block at the end of this file (comment), run separately.
BEGIN;

GRANT SELECT ON public.insight_challenges TO anon, authenticated;
GRANT SELECT, INSERT ON public.insight_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.insight_user_stats TO authenticated;

-- The grants are only safe while RLS is on: refuse to finish otherwise.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname IN ('insight_challenges', 'insight_sessions', 'insight_notes', 'insight_user_stats')
               AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Insight Lab tables must have row level security enabled before 025 grants access';
  END IF;
END $$;

COMMIT;

-- Rollback (separately approved):
-- REVOKE SELECT ON public.insight_challenges FROM anon, authenticated;
-- REVOKE SELECT, INSERT ON public.insight_sessions FROM authenticated;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON public.insight_notes FROM authenticated;
-- REVOKE SELECT, INSERT, UPDATE ON public.insight_user_stats FROM authenticated;
