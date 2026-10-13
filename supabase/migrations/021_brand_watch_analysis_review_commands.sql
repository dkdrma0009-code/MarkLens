-- Brand Watch analysis review commands: LOCAL ONLY until separately approved for production.
-- One publish and one reject function per analysis layer. Publishing a revision draft (supersedes_id)
-- also supersedes its published predecessor; Snapshot publish also switches the profile's current
-- snapshot. State, relations and review events change in one transaction or not at all.
-- Errors use the 'BW_REVIEW:<CODE>' message prefix.
BEGIN;

-- One live successor per published revision. A rejected (withdrawn) revision draft no longer blocks a
-- new revision of the same predecessor; competing draft/published successors remain impossible.
DROP INDEX IF EXISTS public.brand_patterns_successor_idx;
CREATE UNIQUE INDEX brand_patterns_successor_idx ON public.brand_patterns(supersedes_id) WHERE supersedes_id IS NOT NULL AND status <> 'withdrawn';
DROP INDEX IF EXISTS public.brand_takes_successor_idx;
CREATE UNIQUE INDEX brand_takes_successor_idx ON public.brand_takes(supersedes_id) WHERE supersedes_id IS NOT NULL AND status <> 'withdrawn';
DROP INDEX IF EXISTS public.brand_snapshots_successor_idx;
CREATE UNIQUE INDEX brand_snapshots_successor_idx ON public.brand_snapshots(supersedes_id) WHERE supersedes_id IS NOT NULL AND status <> 'withdrawn';

CREATE OR REPLACE FUNCTION public.brand_watch_publish_pattern(p_pattern_id uuid, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE pt record; prev record; superseded uuid;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  SELECT * INTO pt FROM brand_patterns WHERE id=p_pattern_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  IF pt.status <> 'draft' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  -- Every supporting movement must be a current (published, unmerged) fact of the same entity.
  IF NOT EXISTS(SELECT 1 FROM pattern_movements WHERE pattern_id=pt.id) OR EXISTS(
    SELECT 1 FROM pattern_movements pm JOIN brand_movements m ON m.id=pm.movement_id
    WHERE pm.pattern_id=pt.id AND (m.status <> 'published' OR m.merged_into_id IS NOT NULL OR m.entity_id <> pt.entity_id)
  ) THEN RAISE EXCEPTION 'BW_REVIEW:INELIGIBLE_LINEAGE'; END IF;
  IF (SELECT count(DISTINCT m.event_key) FROM pattern_movements pm JOIN brand_movements m ON m.id=pm.movement_id WHERE pm.pattern_id=pt.id) < 2
  THEN RAISE EXCEPTION 'BW_REVIEW:INSUFFICIENT_INDEPENDENT_MOVEMENTS'; END IF;
  -- Facts must still be intact: approved active evidence with an approved primary actor match.
  IF EXISTS(SELECT 1 FROM pattern_movements pm JOIN movement_evidence me ON me.movement_id=pm.movement_id JOIN brand_evidence e ON e.id=me.evidence_id
    WHERE pm.pattern_id=pt.id AND (e.review_status <> 'approved' OR e.status <> 'active' OR NOT EXISTS(
      SELECT 1 FROM source_entity_matches sm WHERE sm.source_item_id=e.source_item_id AND sm.entity_id=e.entity_id AND sm.role='primary' AND sm.review_status='approved')))
  THEN RAISE EXCEPTION 'BW_REVIEW:BROKEN_LINEAGE'; END IF;
  IF pt.supersedes_id IS NOT NULL THEN
    SELECT * INTO prev FROM brand_patterns WHERE id=pt.supersedes_id FOR UPDATE;
    IF prev.status IS DISTINCT FROM 'published' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_PREDECESSOR'; END IF;
    UPDATE brand_patterns SET status='superseded' WHERE id=prev.id; superseded := prev.id;
    INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('pattern',prev.id,'supersede',btrim(p_actor),btrim(p_reason));
  END IF;
  UPDATE brand_patterns SET status='published' WHERE id=pt.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('pattern',pt.id,'publish',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('patternId',pt.id,'supersededId',superseded);
END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_reject_pattern(p_pattern_id uuid, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE pt record;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  SELECT * INTO pt FROM brand_patterns WHERE id=p_pattern_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  IF pt.status <> 'draft' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  UPDATE brand_patterns SET status='withdrawn' WHERE id=pt.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('pattern',pt.id,'reject',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('patternId',pt.id);
END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_publish_take(p_take_id uuid, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE tk record; prev record; superseded uuid;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  SELECT * INTO tk FROM brand_takes WHERE id=p_take_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  IF tk.status <> 'draft' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  IF NOT EXISTS(SELECT 1 FROM brand_patterns WHERE id=tk.pattern_id AND entity_id=tk.entity_id AND status='published') THEN RAISE EXCEPTION 'BW_REVIEW:INELIGIBLE_LINEAGE'; END IF;
  -- Every take evidence must be approved, active and reachable through the Pattern's movements.
  IF NOT EXISTS(SELECT 1 FROM take_evidence WHERE take_id=tk.id) OR EXISTS(
    SELECT 1 FROM take_evidence te JOIN brand_evidence e ON e.id=te.evidence_id
    WHERE te.take_id=tk.id AND (e.review_status <> 'approved' OR e.status <> 'active' OR NOT EXISTS(
      SELECT 1 FROM pattern_movements pm JOIN movement_evidence me ON me.movement_id=pm.movement_id WHERE pm.pattern_id=tk.pattern_id AND me.evidence_id=te.evidence_id))
  ) THEN RAISE EXCEPTION 'BW_REVIEW:BROKEN_LINEAGE'; END IF;
  -- One current Take per Pattern: only the declared predecessor may currently be published.
  IF EXISTS(SELECT 1 FROM brand_takes WHERE pattern_id=tk.pattern_id AND status='published' AND id IS DISTINCT FROM tk.supersedes_id) THEN RAISE EXCEPTION 'BW_REVIEW:REVISION_REQUIRED'; END IF;
  IF tk.supersedes_id IS NOT NULL THEN
    SELECT * INTO prev FROM brand_takes WHERE id=tk.supersedes_id FOR UPDATE;
    IF prev.status IS DISTINCT FROM 'published' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_PREDECESSOR'; END IF;
    UPDATE brand_takes SET status='superseded' WHERE id=prev.id; superseded := prev.id;
    INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('take',prev.id,'supersede',btrim(p_actor),btrim(p_reason));
  END IF;
  UPDATE brand_takes SET status='published' WHERE id=tk.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('take',tk.id,'publish',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('takeId',tk.id,'supersededId',superseded);
END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_reject_take(p_take_id uuid, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE tk record;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  SELECT * INTO tk FROM brand_takes WHERE id=p_take_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  IF tk.status <> 'draft' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  UPDATE brand_takes SET status='withdrawn' WHERE id=tk.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('take',tk.id,'reject',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('takeId',tk.id);
END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_publish_snapshot(p_snapshot_id uuid, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE sn record; prev record; superseded uuid; previous_current uuid;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  SELECT * INTO sn FROM brand_snapshots WHERE id=p_snapshot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  IF sn.status <> 'draft' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  IF NOT EXISTS(SELECT 1 FROM snapshot_takes WHERE snapshot_id=sn.id) OR EXISTS(
    SELECT 1 FROM snapshot_takes st JOIN brand_takes t ON t.id=st.take_id WHERE st.snapshot_id=sn.id AND (t.status <> 'published' OR t.entity_id <> sn.entity_id)
  ) THEN RAISE EXCEPTION 'BW_REVIEW:INELIGIBLE_LINEAGE'; END IF;
  -- Each Take must still rest on a published Pattern and approved, active evidence.
  IF EXISTS(SELECT 1 FROM snapshot_takes st JOIN brand_takes t ON t.id=st.take_id
    WHERE st.snapshot_id=sn.id AND (NOT EXISTS(SELECT 1 FROM brand_patterns p WHERE p.id=t.pattern_id AND p.status='published')
      OR EXISTS(SELECT 1 FROM take_evidence te JOIN brand_evidence e ON e.id=te.evidence_id WHERE te.take_id=t.id AND (e.review_status <> 'approved' OR e.status <> 'active'))))
  THEN RAISE EXCEPTION 'BW_REVIEW:BROKEN_LINEAGE'; END IF;
  IF sn.evidence_count <> (SELECT count(DISTINCT te.evidence_id) FROM snapshot_takes st JOIN take_evidence te ON te.take_id=st.take_id WHERE st.snapshot_id=sn.id)
    OR sn.source_count <> (SELECT count(DISTINCT e.source_item_id) FROM snapshot_takes st JOIN take_evidence te ON te.take_id=st.take_id JOIN brand_evidence e ON e.id=te.evidence_id WHERE st.snapshot_id=sn.id)
  THEN RAISE EXCEPTION 'BW_REVIEW:COVERAGE_COUNT_MISMATCH'; END IF;
  -- One current Snapshot per entity: only the declared predecessor may currently be published.
  IF EXISTS(SELECT 1 FROM brand_snapshots WHERE entity_id=sn.entity_id AND status='published' AND id IS DISTINCT FROM sn.supersedes_id) THEN RAISE EXCEPTION 'BW_REVIEW:REVISION_REQUIRED'; END IF;
  SELECT current_snapshot_id INTO previous_current FROM brand_watch_profiles WHERE entity_id=sn.entity_id FOR UPDATE;
  IF sn.supersedes_id IS NOT NULL THEN
    SELECT * INTO prev FROM brand_snapshots WHERE id=sn.supersedes_id FOR UPDATE;
    IF prev.status IS DISTINCT FROM 'published' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_PREDECESSOR'; END IF;
    UPDATE brand_snapshots SET status='superseded' WHERE id=prev.id; superseded := prev.id;
    INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('snapshot',prev.id,'supersede',btrim(p_actor),btrim(p_reason));
  END IF;
  -- The reviewer of record is the publishing actor (018 requires reviewed_by/reviewed_at).
  UPDATE brand_snapshots SET status='published', reviewed_by=btrim(p_actor), reviewed_at=now() WHERE id=sn.id;
  -- A missing profile is created private/noindex; only the current pointer changes otherwise.
  INSERT INTO brand_watch_profiles(entity_id,current_snapshot_id) VALUES(sn.entity_id,sn.id)
    ON CONFLICT (entity_id) DO UPDATE SET current_snapshot_id=EXCLUDED.current_snapshot_id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('snapshot',sn.id,'publish',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('snapshotId',sn.id,'supersededId',superseded,'previousCurrentSnapshotId',previous_current);
END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_reject_snapshot(p_snapshot_id uuid, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE sn record;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  SELECT * INTO sn FROM brand_snapshots WHERE id=p_snapshot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  IF sn.status <> 'draft' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  UPDATE brand_snapshots SET status='withdrawn' WHERE id=sn.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('snapshot',sn.id,'reject',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('snapshotId',sn.id);
END $$;

-- Review commands are server-side only: no anonymous/authenticated RPC surface.
REVOKE ALL ON FUNCTION public.brand_watch_publish_pattern(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_reject_pattern(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_publish_take(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_reject_take(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_publish_snapshot(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_reject_snapshot(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.brand_watch_publish_pattern(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_reject_pattern(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_publish_take(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_reject_take(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_publish_snapshot(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_reject_snapshot(uuid,text,text) TO service_role;
COMMIT;
