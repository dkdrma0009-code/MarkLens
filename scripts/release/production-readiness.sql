-- MarkLens release (R-4): what production looks like right before 017/023/024/025 and the code deploy. READ ONLY — one
-- SELECT: counts and averages only (no row content, no email, no token), privileges and the three automation flags.
-- Run in the PRODUCTION SQL Editor after check-production-schema.sql; download as CSV for the release record.
--   counts      → how much the migrations touch (023 validates its CHECKs over every cardnews row)
--   avg bytes   → real row sizes, to turn the R-4 egress measurements (synthetic data) into production estimates
--   privileges  → whether Insight Lab is broken in production today (expected: false before 025)
--   priv / rls / policy → the full Insight Lab picture: every table privilege anon and authenticated hold on the four
--                 tables, RLS per table and each policy's definition (025's marker in check-production-schema.sql only
--                 looks at one privilege). exposure → public tables with RLS off that anon/authenticated can read or write.
--   flags       → automation that would run on the first cron after the deploy
--   pre NNN     → what each batch-1 migration assumes. Expected before batch 1: 017 20/20 columns (its trigger function
--                 names them; a missing one would break every UPDATE on insights), 023 0/8 columns and 0/2 constraints,
--                 024 false, 025 4/4 tables with RLS on (025 refuses to grant otherwise).
WITH want_017(col) AS (VALUES ('article_id'), ('category'), ('created_at'), ('framework_analysis'), ('hook'), ('interview_points'), ('is_featured'),
  ('key_takeaways'), ('keywords'), ('legacy_slug'), ('marketing_terms'), ('portfolio_usage'), ('practical_applications'), ('quiz'), ('slug'),
  ('summary'), ('tags'), ('updated_at'), ('video_url'), ('why_it_matters')),
have_017 AS (SELECT w.col, EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'insights' AND c.column_name = w.col) AS ok FROM want_017 w),
lab(t) AS (VALUES ('insight_challenges'), ('insight_sessions'), ('insight_notes'), ('insight_user_stats')),
want_025(t, r, p) AS (VALUES ('insight_challenges', 'anon', 'SELECT'), ('insight_challenges', 'authenticated', 'SELECT'),
  ('insight_sessions', 'authenticated', 'SELECT'), ('insight_sessions', 'authenticated', 'INSERT'),
  ('insight_notes', 'authenticated', 'SELECT'), ('insight_notes', 'authenticated', 'INSERT'), ('insight_notes', 'authenticated', 'UPDATE'), ('insight_notes', 'authenticated', 'DELETE'),
  ('insight_user_stats', 'authenticated', 'SELECT'), ('insight_user_stats', 'authenticated', 'INSERT'), ('insight_user_stats', 'authenticated', 'UPDATE')),
have_025 AS (SELECT w.*, coalesce(has_table_privilege(w.r, to_regclass('public.' || w.t), w.p), false) AS ok FROM want_025 w),
privs(n, p) AS (VALUES (1, 'SELECT'), (2, 'INSERT'), (3, 'UPDATE'), (4, 'DELETE'), (5, 'TRUNCATE'), (6, 'REFERENCES'), (7, 'TRIGGER')),
api_roles(r) AS (VALUES ('anon'), ('authenticated')),
public_tables AS (SELECT c.oid, c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')),
rows(item, value) AS (
  SELECT 'postgres version', current_setting('server_version')
  UNION ALL SELECT 'count: articles', (SELECT count(*) FROM public.articles)::text
  UNION ALL SELECT 'count: articles published', (SELECT count(*) FROM public.articles WHERE status = 'published')::text
  UNION ALL SELECT 'count: insights', (SELECT count(*) FROM public.insights)::text
  UNION ALL SELECT 'count: cardnews', (SELECT count(*) FROM public.cardnews)::text
  UNION ALL SELECT 'count: cardnews posted to Instagram', (SELECT count(*) FROM public.cardnews WHERE posted_at IS NOT NULL)::text
  UNION ALL SELECT 'count: subscribers active', (SELECT count(*) FROM public.subscribers WHERE status = 'active')::text
  UNION ALL SELECT 'count: subscribers pending', (SELECT count(*) FROM public.subscribers WHERE status = 'pending')::text
  UNION ALL SELECT 'count: subscribers unsubscribed', (SELECT count(*) FROM public.subscribers WHERE status = 'unsubscribed')::text
  UNION ALL SELECT 'count: insight_sessions', (SELECT count(*) FROM public.insight_sessions)::text
  UNION ALL SELECT 'count: auth users', (SELECT count(*) FROM auth.users)::text
  UNION ALL SELECT 'avg bytes: insights row', (SELECT coalesce(round(avg(pg_column_size(i.*))), 0) FROM public.insights i)::text
  UNION ALL SELECT 'avg bytes: articles.raw_content', (SELECT coalesce(round(avg(pg_column_size(a.raw_content))), 0) FROM public.articles a)::text
  UNION ALL SELECT 'size: insights table', pg_size_pretty(pg_total_relation_size('public.insights'))
  UNION ALL SELECT 'size: articles table', pg_size_pretty(pg_total_relation_size('public.articles'))
  UNION ALL SELECT 'grant: anon SELECT insight_challenges', has_table_privilege('anon', 'public.insight_challenges', 'SELECT')::text
  UNION ALL SELECT 'grant: authenticated SELECT insight_sessions', has_table_privilege('authenticated', 'public.insight_sessions', 'SELECT')::text
  UNION ALL SELECT 'grant: authenticated INSERT insight_sessions', has_table_privilege('authenticated', 'public.insight_sessions', 'INSERT')::text
  UNION ALL SELECT 'grant: authenticated INSERT insight_notes', has_table_privilege('authenticated', 'public.insight_notes', 'INSERT')::text
  UNION ALL SELECT 'flag: ' || key, value FROM public.app_config WHERE key IN ('ig_auto_publish', 'site_publish_auto', 'curation_auto_publish')
  UNION ALL SELECT 'size: cardnews table', pg_size_pretty(pg_total_relation_size('public.cardnews'))
  UNION ALL SELECT 'pre 017: insights columns its trigger reads (of 20)', (SELECT count(*) FILTER (WHERE ok) FROM have_017)::text
  UNION ALL SELECT 'pre 017: missing insights columns', coalesce((SELECT string_agg(col, ' ' ORDER BY col) FROM have_017 WHERE NOT ok), 'none')
  UNION ALL SELECT 'pre 017: function behind trigger insights_updated_at', coalesce((SELECT p.proname::text FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = to_regclass('public.insights') AND t.tgname = 'insights_updated_at'), 'no such trigger')
  UNION ALL SELECT 'pre 023: cardnews columns already present (of 8)', (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cardnews'
    AND column_name IN ('ig_publish_state', 'ig_publish_claimed_at', 'ig_publish_error', 'threads_publish_state', 'threads_publish_claimed_at', 'threads_publish_error', 'threads_post_id', 'threads_posted_at'))::text
  UNION ALL SELECT 'pre 023: publish-state constraints already present (of 2)', (SELECT count(*) FROM pg_constraint WHERE conname IN ('cardnews_ig_publish_state_check', 'cardnews_threads_publish_state_check'))::text
  UNION ALL SELECT 'pre 024: ai_usage or consume_ai_quota already present', (to_regclass('public.ai_usage') IS NOT NULL OR to_regprocedure('public.consume_ai_quota(text, text, integer, integer)') IS NOT NULL)::text
  UNION ALL SELECT 'pre 025: Insight Lab tables with RLS on (of 4)', (SELECT count(*) FROM lab JOIN pg_class c ON c.oid = to_regclass('public.' || lab.t) WHERE c.relrowsecurity)::text
  UNION ALL SELECT 'pre 025: Insight Lab policies', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN (SELECT t FROM lab))::text
  UNION ALL SELECT 'pre 025: privileges 025 grants already present (of 11)', (SELECT count(*) FILTER (WHERE ok) FROM have_025)::text
  UNION ALL SELECT 'pre 025: 025 privileges still missing', coalesce((SELECT string_agg(t || '/' || r || '/' || p, ' ' ORDER BY t, r, p) FROM have_025 WHERE NOT ok), 'none')
  UNION ALL SELECT 'priv: ' || lab.t || ' / ' || api_roles.r, coalesce((SELECT string_agg(privs.p, ',' ORDER BY privs.n) FROM privs
    WHERE has_table_privilege(api_roles.r, to_regclass('public.' || lab.t), privs.p)), 'none') FROM lab CROSS JOIN api_roles WHERE to_regclass('public.' || lab.t) IS NOT NULL
  UNION ALL SELECT 'rls: ' || lab.t, CASE WHEN c.relrowsecurity THEN 'on' ELSE 'OFF' END || CASE WHEN c.relforcerowsecurity THEN ' (forced)' ELSE '' END
    FROM lab JOIN pg_class c ON c.oid = to_regclass('public.' || lab.t)
  UNION ALL SELECT 'policy: ' || pol.tablename || ' / ' || pol.policyname, pol.cmd || ' to ' || array_to_string(pol.roles, ',') || ' using ' || coalesce(pol.qual, '-') || ' with check ' || coalesce(pol.with_check, '-')
    FROM pg_policies pol WHERE pol.schemaname = 'public' AND pol.tablename IN (SELECT t FROM lab)
  UNION ALL SELECT 'count: insight_notes', (SELECT count(*) FROM public.insight_notes)::text
  UNION ALL SELECT 'count: insight_user_stats', (SELECT count(*) FROM public.insight_user_stats)::text
  UNION ALL SELECT 'count: insight_challenges', (SELECT count(*) FROM public.insight_challenges)::text
  UNION ALL SELECT 'exposure: public tables with RLS off that anon/authenticated can SELECT', coalesce((SELECT string_agg(relname, ' ' ORDER BY relname) FROM public_tables
    WHERE NOT relrowsecurity AND (has_table_privilege('anon', oid, 'SELECT') OR has_table_privilege('authenticated', oid, 'SELECT'))), 'none')
  UNION ALL SELECT 'exposure: public tables with RLS off that anon/authenticated can INSERT/UPDATE/DELETE', coalesce((SELECT string_agg(relname, ' ' ORDER BY relname) FROM public_tables
    WHERE NOT relrowsecurity AND (has_table_privilege('anon', oid, 'INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated', oid, 'INSERT,UPDATE,DELETE'))), 'none')
)
SELECT item, value FROM rows ORDER BY item;
