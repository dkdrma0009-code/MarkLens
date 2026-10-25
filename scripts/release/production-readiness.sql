-- MarkLens release (R-4): what production looks like right before 017/023/024/025 and the code deploy. READ ONLY — one
-- SELECT: counts and averages only (no row content, no email, no token), privileges and the three automation flags.
-- Run in the PRODUCTION SQL Editor after check-production-schema.sql; download as CSV for the release record.
--   counts      → how much the migrations touch (023 validates its CHECKs over every cardnews row)
--   avg bytes   → real row sizes, to turn the R-4 egress measurements (synthetic data) into production estimates
--   privileges  → whether Insight Lab is broken in production today (expected: false before 025)
--   flags       → automation that would run on the first cron after the deploy
WITH rows(item, value) AS (
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
)
SELECT item, value FROM rows ORDER BY item;
