-- Brand Watch: maintain brand_watch_profiles.last_meaningful_update_at. LOCAL ONLY until separately approved.
-- Meaningful = a state change that alters published intelligence:
--   Movement / Pattern / Take / Snapshot becoming published, or a published one being superseded / withdrawn
--   (revisions, merges), and Evidence correction (active -> superseded / withdrawn) while it backs a
--   published Movement.
-- Drafts, draft saves, reviews of pending rows, source collection and reads never change the timestamp.
-- Runs inside the review command's transaction, so it commits or rolls back with the command. No data backfill.
-- Deferred to commit: a Snapshot revision supersedes the old Snapshot before 021 switches current_snapshot_id,
-- and the 018 profile validation must only see the profile after that switch.
BEGIN;

CREATE OR REPLACE FUNCTION public.brand_watch_mark_meaningful_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME = 'brand_evidence' THEN
    IF NOT (OLD.status = 'active' AND NEW.status IN ('superseded','withdrawn')) THEN RETURN NULL; END IF;
    IF NOT EXISTS (SELECT 1 FROM movement_evidence me JOIN brand_movements m ON m.id = me.movement_id
                   WHERE me.evidence_id = NEW.id AND m.status = 'published') THEN RETURN NULL; END IF;
  ELSIF NOT (NEW.status = 'published' OR (OLD.status = 'published' AND NEW.status IN ('superseded','withdrawn'))) THEN
    RETURN NULL;
  END IF;
  -- A missing profile is created with the 018 defaults (private / noindex / paused), as Snapshot publish does.
  INSERT INTO brand_watch_profiles(entity_id, last_meaningful_update_at) VALUES (NEW.entity_id, now())
    ON CONFLICT (entity_id) DO UPDATE SET last_meaningful_update_at =
      greatest(coalesce(brand_watch_profiles.last_meaningful_update_at, EXCLUDED.last_meaningful_update_at), EXCLUDED.last_meaningful_update_at);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.brand_watch_mark_meaningful_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bw_meaningful_update ON public.brand_movements;
CREATE CONSTRAINT TRIGGER bw_meaningful_update AFTER UPDATE OF status ON public.brand_movements DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.brand_watch_mark_meaningful_update();
DROP TRIGGER IF EXISTS bw_meaningful_update ON public.brand_patterns;
CREATE CONSTRAINT TRIGGER bw_meaningful_update AFTER UPDATE OF status ON public.brand_patterns DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.brand_watch_mark_meaningful_update();
DROP TRIGGER IF EXISTS bw_meaningful_update ON public.brand_takes;
CREATE CONSTRAINT TRIGGER bw_meaningful_update AFTER UPDATE OF status ON public.brand_takes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.brand_watch_mark_meaningful_update();
DROP TRIGGER IF EXISTS bw_meaningful_update ON public.brand_snapshots;
CREATE CONSTRAINT TRIGGER bw_meaningful_update AFTER UPDATE OF status ON public.brand_snapshots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.brand_watch_mark_meaningful_update();
DROP TRIGGER IF EXISTS bw_meaningful_update ON public.brand_evidence;
CREATE CONSTRAINT TRIGGER bw_meaningful_update AFTER UPDATE OF status ON public.brand_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.brand_watch_mark_meaningful_update();

COMMIT;
