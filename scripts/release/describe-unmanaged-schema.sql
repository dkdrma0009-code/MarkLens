-- MarkLens release (R-3): what production really has for the parts no repository migration defines. READ ONLY — plain
-- SELECTs on catalogs, no data rows. Run in the PRODUCTION SQL Editor (needs approval: it reads production metadata) and
-- compare with supabase/preview/001a_unmanaged_tables.sql, which is inferred from code.

-- 1. Columns of the dashboard-made tables and of insights (hook, marketing_terms, quiz, video_url were added by hand)
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('app_config', 'cardnews', 'feedback', 'follower_snapshots', 'quiz_questions', 'site_feedback', 'competitions', 'insights')
ORDER BY table_name, ordinal_position;

-- 2. Primary keys, unique and foreign keys of those tables
SELECT tc.table_name, tc.constraint_type, tc.constraint_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public' AND tc.table_name IN ('app_config', 'cardnews', 'feedback', 'follower_snapshots', 'quiz_questions', 'site_feedback', 'competitions')
ORDER BY tc.table_name, tc.constraint_type;

-- 3. The random_quiz RPC as defined in production
SELECT pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'random_quiz';

-- 4. Row-level security: which public tables have it on, and every policy
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1;
SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- 5. What anon and authenticated may do per table (Insight Lab writes as authenticated after 006 tightened grants)
SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee ORDER BY table_name, grantee;

-- 6. Storage buckets the code uses (cardnews-ig, ad-assets, …)
SELECT id, public FROM storage.buckets ORDER BY id;
