-- Apply before deploying the matching handlers. No existing rows are rewritten.
-- Historical pending links are invalid; deploy first, then separately approve recovery.
BEGIN;
ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS confirmation_token text,
  ADD COLUMN IF NOT EXISTS confirmation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_confirmation_token_unique
  ON public.subscribers (confirmation_token) WHERE confirmation_token IS NOT NULL;

-- Functions use the caller's privileges. Only service_role may execute them.
CREATE OR REPLACE FUNCTION public.issue_subscription_confirmation(
  p_email text, p_token text, p_source text DEFAULT NULL
) RETURNS TABLE(result text, subscription_created boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE changed integer;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid confirmation token format';
  END IF;
  INSERT INTO public.subscribers(email, status, source, confirmation_token, confirmation_expires_at)
    VALUES (p_email, 'pending', p_source, p_token, clock_timestamp() + interval '48 hours')
    ON CONFLICT (email) DO NOTHING;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 1 THEN
    RETURN QUERY SELECT 'issued'::text, true;
    RETURN;
  END IF;

  -- Conditional update obtains a row lock and rechecks status after waiting.
  UPDATE public.subscribers SET status = 'pending',
    confirmation_token = p_token,
    confirmation_expires_at = clock_timestamp() + interval '48 hours',
    source = coalesce(source, p_source)
    WHERE email = p_email AND status <> 'active';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 1 THEN
    RETURN QUERY SELECT 'issued'::text, false;
  ELSIF EXISTS (SELECT 1 FROM public.subscribers WHERE email = p_email AND status = 'active') THEN
    RETURN QUERY SELECT 'already_active'::text, false;
  ELSE
    RAISE EXCEPTION 'Subscription issue failed';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_subscription(p_email text, p_token text)
RETURNS TABLE(result text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE changed integer;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN
    RETURN QUERY SELECT 'invalid_or_consumed'::text;
    RETURN;
  END IF;
  WITH transitioned AS (
    UPDATE public.subscribers SET status = 'active',
      confirmed_at = clock_timestamp(), subscribed_at = clock_timestamp(),
      confirmation_token = NULL, confirmation_expires_at = NULL
    WHERE email = p_email AND confirmation_token = p_token
      AND status = 'pending' AND confirmation_expires_at > clock_timestamp()
    RETURNING id
  ) SELECT count(*) INTO changed FROM transitioned;
  IF changed = 1 THEN
    RETURN QUERY SELECT 'confirmed'::text;
  ELSIF changed > 1 THEN
    -- Raising rolls back the entire statement, never a partial success.
    RAISE EXCEPTION 'Unexpected confirmation row count';
  ELSIF EXISTS (SELECT 1 FROM public.subscribers
    WHERE email = p_email AND confirmation_token = p_token AND status = 'pending'
      AND confirmation_expires_at <= clock_timestamp()) THEN
    RETURN QUERY SELECT 'expired'::text;
  ELSE
    RETURN QUERY SELECT 'invalid_or_consumed'::text;
  END IF;
END;
$$;

-- One-off recovery claims only untouched legacy pending rows. No automatic activation.
CREATE OR REPLACE FUNCTION public.recover_legacy_pending_subscription(p_id uuid, p_token text)
RETURNS TABLE(email text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid confirmation token format';
  END IF;
  RETURN QUERY UPDATE public.subscribers AS s SET
    confirmation_token = p_token,
    confirmation_expires_at = clock_timestamp() + interval '48 hours'
  WHERE s.id = p_id AND s.status = 'pending'
    AND s.confirmation_token IS NULL AND s.confirmation_expires_at IS NULL
    AND s.confirmed_at IS NULL
  RETURNING s.email;
END;
$$;

-- Release only our failed-mail claim. Never clear a newer signup token or active row.
CREATE OR REPLACE FUNCTION public.release_legacy_pending_recovery(p_id uuid, p_token text)
RETURNS TABLE(released boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN QUERY UPDATE public.subscribers AS s SET
    confirmation_token = NULL, confirmation_expires_at = NULL
  WHERE s.id = p_id AND s.status = 'pending' AND s.confirmation_token = p_token
    AND s.confirmed_at IS NULL
  RETURNING true;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_subscription_confirmation(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_subscription(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recover_legacy_pending_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_legacy_pending_recovery(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_subscription_confirmation(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_subscription(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_legacy_pending_subscription(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_legacy_pending_recovery(uuid, text) TO service_role;
-- Needed if default privileges differ; existing table privileges/RLS are unchanged.
GRANT SELECT, INSERT, UPDATE ON public.subscribers TO service_role;
COMMIT;
