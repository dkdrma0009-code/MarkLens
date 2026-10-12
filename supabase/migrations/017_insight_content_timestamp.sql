-- updated_at is the insight's content/editorial modification time, not a view
-- metric timestamp. No existing timestamps are backfilled or rows rewritten.
BEGIN;

CREATE OR REPLACE FUNCTION public.update_insight_content_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF ROW(
    NEW.article_id, NEW.slug, NEW.legacy_slug, NEW.created_at, NEW.is_featured,
    NEW.hook, NEW.summary, NEW.key_takeaways, NEW.why_it_matters,
    NEW.practical_applications, NEW.framework_analysis, NEW.portfolio_usage,
    NEW.interview_points, NEW.category, NEW.tags, NEW.keywords,
    NEW.video_url, NEW.marketing_terms, NEW.quiz
  ) IS DISTINCT FROM ROW(
    OLD.article_id, OLD.slug, OLD.legacy_slug, OLD.created_at, OLD.is_featured,
    OLD.hook, OLD.summary, OLD.key_takeaways, OLD.why_it_matters,
    OLD.practical_applications, OLD.framework_analysis, OLD.portfolio_usage,
    OLD.interview_points, OLD.category, OLD.tags, OLD.keywords,
    OLD.video_url, OLD.marketing_terms, OLD.quiz
  ) THEN
    NEW.updated_at = now();
  ELSE
    -- Preserve even when a metric writer explicitly supplies updated_at.
    NEW.updated_at = OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS insights_updated_at ON public.insights;
CREATE TRIGGER insights_updated_at BEFORE UPDATE ON public.insights
  FOR EACH ROW EXECUTE FUNCTION public.update_insight_content_updated_at();

COMMIT;

-- Rollback (separately, only if explicitly approved):
-- BEGIN;
-- DROP TRIGGER IF EXISTS insights_updated_at ON public.insights;
-- CREATE TRIGGER insights_updated_at BEFORE UPDATE ON public.insights
--   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
-- DROP FUNCTION IF EXISTS public.update_insight_content_updated_at();
-- COMMIT;
