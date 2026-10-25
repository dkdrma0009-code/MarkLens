-- MarkLens personal data deletion (R-4). Run in the PRODUCTION Supabase SQL Editor by the operator; each section is
-- independent. [A]/[B]: replace {{...}} first. Retention periods = src/lib/privacy/retention.ts (owner-confirmed
-- 2026-10-25); the same rules run daily by themselves (/api/cron/privacy-purge) - [C] is the manual fallback.
-- Procedure and request handling: docs/release/privacy-operations.md. Tested: tests/privacy-deletion.test.mjs.

-- [A] A subscriber asks to be deleted: their subscription and their newsletter send/open/click records.
BEGIN;
DELETE FROM public.newsletter_events WHERE lower(email) = lower('{{EMAIL}}');
DELETE FROM public.subscribers WHERE lower(email) = lower('{{EMAIL}}');
COMMIT;

-- [B] A member asks to be deleted. First delete the user in Supabase -> Authentication -> Users (their Insight Lab
-- sessions, notes and stats go with the account: ON DELETE CASCADE). Then remove the AI usage counters kept for them.
DELETE FROM public.ai_usage WHERE key = 'user:{{USER_ID}}';

-- [C] Manual fallback for the daily purge: everything past its retention period.
BEGIN;
DELETE FROM public.subscribers WHERE status = 'unsubscribed';
DELETE FROM public.subscribers WHERE status = 'pending' AND confirmed_at IS NULL AND subscribed_at < now() - interval '7 days';
DELETE FROM public.newsletter_events e WHERE e.created_at < now() - interval '90 days'
  OR NOT EXISTS (SELECT 1 FROM public.subscribers s WHERE lower(s.email) = lower(e.email));
DELETE FROM public.ai_usage WHERE window_start < now() - interval '90 days';
DELETE FROM public.feedback WHERE created_at < now() - interval '183 days';
COMMIT;
