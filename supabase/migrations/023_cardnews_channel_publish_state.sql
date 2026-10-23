-- Per-channel publish state for card news (Instagram, Threads).
-- A publish first claims its channel with a conditional UPDATE (state null/failed -> publishing), so two
-- requests cannot both post. An error before the platform's publish call -> failed (retryable); an error
-- during/after it, or a post the database could not record -> needs_review (never re-posted automatically).
-- posted_at / ig_post_id stay the Instagram "published" record used by admin, calendar and metrics.
-- Additive only: no existing row is rewritten. Apply BEFORE deploying the matching publish code.
BEGIN;

ALTER TABLE public.cardnews
  ADD COLUMN IF NOT EXISTS ig_publish_state text,
  ADD COLUMN IF NOT EXISTS ig_publish_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ig_publish_error text,
  ADD COLUMN IF NOT EXISTS threads_publish_state text,
  ADD COLUMN IF NOT EXISTS threads_publish_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS threads_publish_error text,
  ADD COLUMN IF NOT EXISTS threads_post_id text,
  ADD COLUMN IF NOT EXISTS threads_posted_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cardnews_ig_publish_state_check') THEN
    ALTER TABLE public.cardnews ADD CONSTRAINT cardnews_ig_publish_state_check
      CHECK (ig_publish_state IS NULL OR ig_publish_state IN ('publishing', 'published', 'failed', 'needs_review'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cardnews_threads_publish_state_check') THEN
    ALTER TABLE public.cardnews ADD CONSTRAINT cardnews_threads_publish_state_check
      CHECK (threads_publish_state IS NULL OR threads_publish_state IN ('publishing', 'published', 'failed', 'needs_review'));
  END IF;
END $$;

COMMIT;

-- Rollback (separately, only if explicitly approved; the publish code that uses these columns must be reverted first):
-- BEGIN;
-- ALTER TABLE public.cardnews DROP CONSTRAINT IF EXISTS cardnews_ig_publish_state_check,
--   DROP CONSTRAINT IF EXISTS cardnews_threads_publish_state_check,
--   DROP COLUMN IF EXISTS ig_publish_state, DROP COLUMN IF EXISTS ig_publish_claimed_at, DROP COLUMN IF EXISTS ig_publish_error,
--   DROP COLUMN IF EXISTS threads_publish_state, DROP COLUMN IF EXISTS threads_publish_claimed_at, DROP COLUMN IF EXISTS threads_publish_error,
--   DROP COLUMN IF EXISTS threads_post_id, DROP COLUMN IF EXISTS threads_posted_at;
-- COMMIT;
