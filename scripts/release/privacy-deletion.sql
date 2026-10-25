-- MarkLens personal data deletion (R-4). Run in the PRODUCTION Supabase SQL Editor by the operator; each section is
-- independent. Replace every {{...}} first - the retention days are the operator's decisions (src/lib/legal/privacy.ts).
-- Procedure and request handling: docs/release/privacy-operations.md. Tested: tests/privacy-deletion.test.mjs.

-- [A] A subscriber asks to be deleted: their subscription and their newsletter send/open/click records.
BEGIN;
DELETE FROM public.newsletter_events WHERE lower(email) = lower('{{EMAIL}}');
DELETE FROM public.subscribers WHERE lower(email) = lower('{{EMAIL}}');
COMMIT;

-- [B] A member asks to be deleted. First delete the user in Supabase -> Authentication -> Users (their Insight Lab
-- sessions, notes and stats go with the account: ON DELETE CASCADE). Then remove the AI usage counters kept for them.
DELETE FROM public.ai_usage WHERE key = 'user:{{USER_ID}}';

-- [C] Monthly: delete what has passed its retention period.
BEGIN;
DELETE FROM public.subscribers WHERE status = 'unsubscribed' AND unsubscribed_at < now() - interval '{{UNSUBSCRIBED_DAYS}} days';
DELETE FROM public.subscribers WHERE status = 'pending' AND confirmed_at IS NULL AND subscribed_at < now() - interval '{{UNCONFIRMED_DAYS}} days';
DELETE FROM public.newsletter_events e WHERE e.created_at < now() - interval '{{EVENT_DAYS}} days'
  OR NOT EXISTS (SELECT 1 FROM public.subscribers s WHERE lower(s.email) = lower(e.email));
DELETE FROM public.ai_usage WHERE window_start < now() - interval '{{AI_USAGE_DAYS}} days';
DELETE FROM public.feedback WHERE created_at < now() - interval '{{FEEDBACK_DAYS}} days';
COMMIT;
