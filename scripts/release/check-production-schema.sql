-- MarkLens release check (R-2): which repository migrations are present in a database. READ ONLY — one SELECT, no
-- writes, no settings. Run it in the Supabase SQL Editor of the target project (Production before a deploy, the
-- Preview project after preparing it) and compare with supabase/migrations/. A migration is "present" when its
-- distinctive artifact exists; partial application shows as a mix of true/false within the same number.
WITH checks(migration, artifact, present) AS (VALUES
  ('001', 'tables articles/insights/subscribers', to_regclass('public.articles') IS NOT NULL AND to_regclass('public.insights') IS NOT NULL AND to_regclass('public.subscribers') IS NOT NULL),
  ('002', 'newsletter_issues.topic_headline', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'newsletter_issues' AND column_name = 'topic_headline')),
  ('003', 'table newsletter_events', to_regclass('public.newsletter_events') IS NOT NULL),
  ('004', 'tables insight_challenges/insight_sessions', to_regclass('public.insight_challenges') IS NOT NULL AND to_regclass('public.insight_sessions') IS NOT NULL),
  ('006', 'anon cannot read subscribers (005→006 tightened)', CASE WHEN to_regclass('public.subscribers') IS NULL THEN false ELSE NOT has_table_privilege('anon', 'public.subscribers', 'SELECT') END),
  ('007', 'newsletter_issues.approved_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'newsletter_issues' AND column_name = 'approved_at')),
  ('008', 'subscribers.drip_step', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscribers' AND column_name = 'drip_step')),
  ('009', 'cardnews.reel_settings', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cardnews' AND column_name = 'reel_settings')),
  ('010', 'table content_metrics', to_regclass('public.content_metrics') IS NOT NULL),
  ('011', 'table curations', to_regclass('public.curations') IS NOT NULL),
  ('012', 'insights.legacy_slug', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insights' AND column_name = 'legacy_slug')),
  ('013', 'subscribers.source', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscribers' AND column_name = 'source')),
  ('014', 'articles.site_published_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'articles' AND column_name = 'site_published_at')),
  ('015', 'articles.fallback_image', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'articles' AND column_name = 'fallback_image')),
  ('016', 'function issue_subscription_confirmation + subscribers.confirmation_token', to_regprocedure('public.issue_subscription_confirmation(text,text,text)') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscribers' AND column_name = 'confirmation_token')),
  ('017', 'trigger insights_updated_at uses update_insight_content_updated_at', EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid WHERE t.tgrelid = to_regclass('public.insights') AND t.tgname = 'insights_updated_at' AND p.proname = 'update_insight_content_updated_at')),
  ('018', 'tables brand_entities/brand_watch_profiles', to_regclass('public.brand_entities') IS NOT NULL AND to_regclass('public.brand_watch_profiles') IS NOT NULL),
  ('019', 'function brand_watch_approve_evidence', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'brand_watch_approve_evidence')),
  ('020', 'brand_takes.confidence', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'brand_takes' AND column_name = 'confidence')),
  ('021', 'function brand_watch_publish_pattern', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'brand_watch_publish_pattern')),
  ('022', 'function brand_watch_mark_meaningful_update', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'brand_watch_mark_meaningful_update')),
  ('023', 'cardnews.ig_publish_state / threads_publish_state', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cardnews' AND column_name = 'ig_publish_state') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cardnews' AND column_name = 'threads_publish_state')),
  ('024', 'table ai_usage + function consume_ai_quota', to_regclass('public.ai_usage') IS NOT NULL AND to_regprocedure('public.consume_ai_quota(text,text,integer,integer)') IS NOT NULL)
)
SELECT migration, artifact, present FROM checks ORDER BY migration;
