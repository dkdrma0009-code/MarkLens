-- Brand Watch review commands: LOCAL ONLY until separately approved for production.
-- One function per review command. Each locks its targets, validates the transition,
-- changes state/relations and appends the review event in the caller's transaction,
-- so any failure (including deferred publication checks at commit) rolls back everything.
-- No schema change. Errors use the 'BW_REVIEW:<CODE>' message prefix.
BEGIN;

CREATE OR REPLACE FUNCTION public.brand_watch_approve_evidence(p_evidence_id uuid, p_match_role text, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE ev record; m record;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  IF p_match_role IS NULL OR p_match_role NOT IN ('primary','secondary','mentioned') THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_MATCH_ROLE'; END IF;
  SELECT * INTO ev FROM brand_evidence WHERE id=p_evidence_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  IF ev.review_status <> 'pending' OR ev.status <> 'active' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  -- The reviewer adjudicates the source-level actor role together with the fact.
  SELECT * INTO m FROM source_entity_matches WHERE source_item_id=ev.source_item_id AND entity_id=ev.entity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:MATCH_NOT_FOUND'; END IF;
  IF m.review_status='rejected' THEN RAISE EXCEPTION 'BW_REVIEW:MATCH_REJECTED'; END IF;
  IF m.review_status='approved' AND m.role <> p_match_role THEN RAISE EXCEPTION 'BW_REVIEW:MATCH_ROLE_CONFLICT'; END IF;
  UPDATE source_entity_matches SET role=p_match_role, review_status='approved' WHERE id=m.id;
  UPDATE brand_evidence SET review_status='approved' WHERE id=ev.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('evidence',ev.id,'approve',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('evidenceId',ev.id,'matchId',m.id,'matchRole',p_match_role);
END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_reject_evidence(p_evidence_id uuid, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE ev record;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  SELECT * INTO ev FROM brand_evidence WHERE id=p_evidence_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  -- Approved evidence is corrected by supersede, never reset to rejected.
  IF ev.review_status <> 'pending' OR ev.status <> 'active' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  UPDATE brand_evidence SET review_status='rejected' WHERE id=ev.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('evidence',ev.id,'reject',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('evidenceId',ev.id);
END $$;

-- Correction of reviewed evidence: a pending same-entity successor replaces the approved fact.
CREATE OR REPLACE FUNCTION public.brand_watch_supersede_evidence(p_evidence_id uuid, p_source_item_id uuid, p_fact text, p_support_text text, p_support_locator text, p_event_date date, p_date_precision text, p_marketing_relevance numeric, p_confidence numeric, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE ev record; successor uuid;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  SELECT * INTO ev FROM brand_evidence WHERE id=p_evidence_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  IF ev.review_status <> 'approved' OR ev.status <> 'active' OR EXISTS(SELECT 1 FROM brand_evidence WHERE supersedes_id=ev.id) THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  INSERT INTO brand_evidence(entity_id,source_item_id,fact,support_text,support_locator,event_date,date_precision,marketing_relevance,confidence,extraction_method,review_status,status,supersedes_id,correction_reason)
    VALUES(ev.entity_id,coalesce(p_source_item_id,ev.source_item_id),p_fact,p_support_text,p_support_locator,p_event_date,p_date_precision,p_marketing_relevance,p_confidence,'manual','pending','active',ev.id,btrim(p_reason))
    RETURNING id INTO successor;
  UPDATE brand_evidence SET status='superseded' WHERE id=ev.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('evidence',ev.id,'supersede',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('evidenceId',ev.id,'successorId',successor);
END $$;

-- The deferred bw_publication trigger still verifies approved primary-action evidence at commit.
CREATE OR REPLACE FUNCTION public.brand_watch_approve_movement(p_movement_id uuid, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE mv record;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  SELECT * INTO mv FROM brand_movements WHERE id=p_movement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  IF mv.status <> 'draft' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  UPDATE brand_movements SET status='published' WHERE id=mv.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('movement',mv.id,'approve',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('movementId',mv.id);
END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_reject_movement(p_movement_id uuid, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE mv record;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  SELECT * INTO mv FROM brand_movements WHERE id=p_movement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  -- Published movements are corrected by supersede/merge, not rejected.
  IF mv.status <> 'draft' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  UPDATE brand_movements SET status='withdrawn' WHERE id=mv.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('movement',mv.id,'reject',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('movementId',mv.id);
END $$;

-- 018 has no movement supersedes_id; merged_into_id is the successor pointer and the
-- review event action ('supersede' vs 'merge') records which operation produced it.
CREATE OR REPLACE FUNCTION public.brand_watch_supersede_movement(p_movement_id uuid, p_event_key text, p_title text, p_summary text, p_movement_type text, p_scope text, p_market text[], p_channel text[], p_started_at timestamptz, p_last_observed_at timestamptz, p_importance integer, p_evidence_ids uuid[], p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE mv record; successor uuid;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  SELECT * INTO mv FROM brand_movements WHERE id=p_movement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  IF mv.status <> 'published' THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  IF coalesce(cardinality(p_evidence_ids),0)=0 THEN RAISE EXCEPTION 'BW_REVIEW:SUCCESSOR_EVIDENCE_REQUIRED'; END IF;
  IF (SELECT count(*) FROM brand_evidence WHERE id=ANY(p_evidence_ids) AND entity_id=mv.entity_id AND status='active' AND review_status <> 'rejected')
     <> (SELECT count(DISTINCT x) FROM unnest(p_evidence_ids) x) THEN RAISE EXCEPTION 'BW_REVIEW:SUCCESSOR_EVIDENCE_INVALID'; END IF;
  INSERT INTO brand_movements(entity_id,event_key,title,summary,movement_type,scope,market,channel,started_at,last_observed_at,importance,status)
    VALUES(mv.entity_id,p_event_key,p_title,p_summary,p_movement_type,p_scope,coalesce(p_market,'{}'),coalesce(p_channel,'{}'),p_started_at,p_last_observed_at,p_importance,'draft')
    RETURNING id INTO successor;
  INSERT INTO movement_evidence(entity_id,movement_id,evidence_id) SELECT DISTINCT mv.entity_id,successor,x FROM unnest(p_evidence_ids) x;
  UPDATE brand_movements SET status='superseded', merged_into_id=successor WHERE id=mv.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('movement',mv.id,'supersede',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('movementId',mv.id,'successorId',successor);
END $$;

-- Source links are never removed. A draft target gains the source's usable evidence links;
-- a published target's links are immutable, so its lineage is reached through merged_into_id.
CREATE OR REPLACE FUNCTION public.brand_watch_merge_movement(p_source_id uuid, p_target_id uuid, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE src record; dst record; copied integer := 0;
BEGIN
  IF nullif(btrim(p_actor),'') IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:PROVENANCE_REQUIRED'; END IF;
  IF p_source_id = p_target_id THEN RAISE EXCEPTION 'BW_REVIEW:SELF_MERGE'; END IF;
  -- Lock both rows in a stable order so concurrent opposite merges cannot deadlock.
  PERFORM 1 FROM brand_movements WHERE id IN (p_source_id,p_target_id) ORDER BY id FOR UPDATE;
  SELECT * INTO src FROM brand_movements WHERE id=p_source_id;
  SELECT * INTO dst FROM brand_movements WHERE id=p_target_id;
  IF src.id IS NULL OR dst.id IS NULL THEN RAISE EXCEPTION 'BW_REVIEW:NOT_FOUND'; END IF;
  IF src.entity_id <> dst.entity_id THEN RAISE EXCEPTION 'BW_REVIEW:ENTITY_MISMATCH'; END IF;
  -- Repeated merge into the same target is an idempotent no-op with no second event.
  IF src.status='superseded' AND src.merged_into_id=dst.id THEN
    RETURN jsonb_build_object('sourceId',src.id,'targetId',dst.id,'noop',true,'copiedLinks',0);
  END IF;
  IF src.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_TRANSITION'; END IF;
  IF dst.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'BW_REVIEW:INVALID_MERGE_TARGET'; END IF;
  IF dst.status='draft' THEN
    INSERT INTO movement_evidence(entity_id,movement_id,evidence_id)
      SELECT me.entity_id,dst.id,me.evidence_id FROM movement_evidence me JOIN brand_evidence e ON e.id=me.evidence_id
      WHERE me.movement_id=src.id AND e.status='active' AND e.review_status <> 'rejected'
      ON CONFLICT (movement_id,evidence_id) DO NOTHING;
    GET DIAGNOSTICS copied = ROW_COUNT;
  END IF;
  UPDATE brand_movements SET status='superseded', merged_into_id=dst.id WHERE id=src.id;
  INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) VALUES('movement',src.id,'merge',btrim(p_actor),btrim(p_reason));
  RETURN jsonb_build_object('sourceId',src.id,'targetId',dst.id,'noop',false,'copiedLinks',copied);
END $$;

-- Review commands are server-side only: no anonymous/authenticated RPC surface.
REVOKE ALL ON FUNCTION public.brand_watch_approve_evidence(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_reject_evidence(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_supersede_evidence(uuid,uuid,text,text,text,date,text,numeric,numeric,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_approve_movement(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_reject_movement(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_supersede_movement(uuid,text,text,text,text,text,text[],text[],timestamptz,timestamptz,integer,uuid[],text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_merge_movement(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.brand_watch_approve_evidence(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_reject_evidence(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_supersede_evidence(uuid,uuid,text,text,text,date,text,numeric,numeric,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_approve_movement(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_reject_movement(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_supersede_movement(uuid,text,text,text,text,text,text[],text[],timestamptz,timestamptz,integer,uuid[],text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_merge_movement(uuid,uuid,text,text) TO service_role;
COMMIT;
