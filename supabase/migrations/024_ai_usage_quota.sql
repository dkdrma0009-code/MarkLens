-- Global AI usage quota (R-2). Serverless instances do not share memory, so the per-instance rate limiter cannot cap
-- total paid AI calls. consume_ai_quota() counts one call in a fixed time window and refuses once the window's limit is
-- reached; the check and the increment are one statement, so concurrent requests cannot both take the last slot.
-- Keys are a user id or a hashed client address (never a raw IP). Additive only; apply BEFORE deploying the code that
-- calls it (until then the app logs that the global quota is inactive and keeps its per-instance limits).
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_usage (
  scope text NOT NULL,
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  calls integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
  PRIMARY KEY (scope, key, window_start)
);
CREATE INDEX IF NOT EXISTS ai_usage_window_start_idx ON public.ai_usage (window_start);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY; -- no policies: only service_role (bypasses RLS) reads or writes

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_scope text, p_key text, p_window_seconds integer, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  bucket timestamptz := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  taken integer;
BEGIN
  IF p_limit < 1 OR p_window_seconds < 1 THEN RETURN false; END IF;
  INSERT INTO public.ai_usage AS u (scope, key, window_start, calls) VALUES (p_scope, p_key, bucket, 1)
  ON CONFLICT (scope, key, window_start) DO UPDATE SET calls = u.calls + 1 WHERE u.calls < p_limit
  RETURNING calls INTO taken;
  RETURN taken IS NOT NULL;
END;
$$;

REVOKE ALL ON TABLE public.ai_usage FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ai_quota(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text, text, integer, integer) TO service_role;

COMMIT;

-- Housekeeping (optional, separately): DELETE FROM public.ai_usage WHERE window_start < now() - interval '30 days';
-- Rollback (separately, only if explicitly approved; revert the calling code first):
-- BEGIN; DROP FUNCTION IF EXISTS public.consume_ai_quota(text, text, integer, integer); DROP TABLE IF EXISTS public.ai_usage; COMMIT;
