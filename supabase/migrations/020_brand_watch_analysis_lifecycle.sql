-- Brand Watch analysis lifecycle: LOCAL ONLY until separately approved for production.
-- Adds review-facing candidate fields, one-successor evidence hardening, lineage indexes and
-- one atomic draft-save function per analysis layer. Draft saves never review or publish.
-- Errors use the 'BW_SAVE:<CODE>' message prefix.
BEGIN;

-- Reviewers need the model's stated doubts and triage confidence on stored drafts (frozen once published).
ALTER TABLE public.brand_patterns ADD COLUMN IF NOT EXISTS uncertainties text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.brand_takes ADD COLUMN IF NOT EXISTS confidence numeric CHECK (confidence BETWEEN 0 AND 1);
ALTER TABLE public.brand_takes ADD COLUMN IF NOT EXISTS uncertainties text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.brand_snapshots ADD COLUMN IF NOT EXISTS confidence numeric CHECK (confidence BETWEEN 0 AND 1);
ALTER TABLE public.brand_snapshots ADD COLUMN IF NOT EXISTS uncertainties text[] NOT NULL DEFAULT '{}';
-- Separate column replaces the fragile body + "Watch next:" separator.
ALTER TABLE public.brand_snapshots ADD COLUMN IF NOT EXISTS watch_next text CHECK (watch_next IS NULL OR btrim(watch_next) <> '');

-- One correction successor per evidence (patterns/takes/snapshots already enforce this in 018).
CREATE UNIQUE INDEX IF NOT EXISTS brand_evidence_successor_idx ON public.brand_evidence(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS brand_movements_merged_into_idx ON public.brand_movements(merged_into_id) WHERE merged_into_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.brand_watch_save_pattern_draft(p_id uuid, p_entity_id uuid, p_title text, p_description text, p_window_start date, p_window_end date, p_confidence numeric, p_uncertainties text[], p_revision integer, p_supersedes_id uuid, p_movement_ids uuid[], p_generation_model text, p_prompt_version text, p_pipeline_version text, p_generated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE existing record; wanted uuid[] := (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_movement_ids) x); dup uuid;
BEGIN
  -- Serialize draft saves per entity so duplicate checks cannot race.
  PERFORM 1 FROM brand_entities WHERE id=p_entity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_SAVE:NOT_FOUND'; END IF;
  SELECT * INTO existing FROM brand_patterns WHERE id=p_id;
  IF FOUND THEN
    -- Retrying the same save is a no-op; reusing an ID for different content is refused.
    IF existing.entity_id=p_entity_id AND existing.status='draft' AND (SELECT array_agg(movement_id ORDER BY movement_id) FROM pattern_movements WHERE pattern_id=p_id) = wanted
    THEN RETURN jsonb_build_object('patternId',p_id,'noop',true); END IF;
    RAISE EXCEPTION 'BW_SAVE:ID_CONFLICT';
  END IF;
  IF coalesce(cardinality(wanted),0) < 2 THEN RAISE EXCEPTION 'BW_SAVE:LINEAGE_REQUIRED'; END IF;
  IF (SELECT count(*) FROM brand_movements WHERE id=ANY(wanted) AND entity_id=p_entity_id AND status='published') <> cardinality(wanted) THEN RAISE EXCEPTION 'BW_SAVE:INELIGIBLE_LINEAGE'; END IF;
  IF (SELECT count(DISTINCT event_key) FROM brand_movements WHERE id=ANY(wanted)) < 2 THEN RAISE EXCEPTION 'BW_SAVE:INSUFFICIENT_INDEPENDENT_MOVEMENTS'; END IF;
  SELECT p.id INTO dup FROM brand_patterns p WHERE p.entity_id=p_entity_id AND p.status IN ('draft','published')
    AND (SELECT array_agg(movement_id ORDER BY movement_id) FROM pattern_movements WHERE pattern_id=p.id) = wanted LIMIT 1;
  IF dup IS NOT NULL THEN RAISE EXCEPTION 'BW_SAVE:DUPLICATE'; END IF;
  IF p_supersedes_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM brand_patterns WHERE id=p_supersedes_id AND entity_id=p_entity_id AND status='published') THEN RAISE EXCEPTION 'BW_SAVE:INVALID_PREDECESSOR'; END IF;
  INSERT INTO brand_patterns(id,entity_id,title,description,window_start,window_end,confidence,uncertainties,revision,supersedes_id,status,generation_model,prompt_version,pipeline_version,created_at)
    VALUES(p_id,p_entity_id,p_title,p_description,p_window_start,p_window_end,p_confidence,coalesce(p_uncertainties,'{}'),p_revision,p_supersedes_id,'draft',p_generation_model,p_prompt_version,p_pipeline_version,p_generated_at);
  INSERT INTO pattern_movements(entity_id,pattern_id,movement_id) SELECT p_entity_id,p_id,x FROM unnest(wanted) x;
  RETURN jsonb_build_object('patternId',p_id,'noop',false);
END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_save_take_draft(p_id uuid, p_entity_id uuid, p_pattern_id uuid, p_what_we_see text, p_why_it_may_matter text, p_what_to_watch_next text, p_confidence numeric, p_uncertainties text[], p_revision integer, p_supersedes_id uuid, p_evidence_ids uuid[], p_generation_model text, p_prompt_version text, p_pipeline_version text, p_generated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE existing record; wanted uuid[] := (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_evidence_ids) x); current_take uuid;
BEGIN
  PERFORM 1 FROM brand_entities WHERE id=p_entity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_SAVE:NOT_FOUND'; END IF;
  SELECT * INTO existing FROM brand_takes WHERE id=p_id;
  IF FOUND THEN
    IF existing.entity_id=p_entity_id AND existing.pattern_id=p_pattern_id AND existing.status='draft' AND (SELECT array_agg(evidence_id ORDER BY evidence_id) FROM take_evidence WHERE take_id=p_id) = wanted
    THEN RETURN jsonb_build_object('takeId',p_id,'noop',true); END IF;
    RAISE EXCEPTION 'BW_SAVE:ID_CONFLICT';
  END IF;
  IF coalesce(cardinality(wanted),0) = 0 THEN RAISE EXCEPTION 'BW_SAVE:LINEAGE_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM brand_patterns WHERE id=p_pattern_id AND entity_id=p_entity_id AND status='published') THEN RAISE EXCEPTION 'BW_SAVE:INELIGIBLE_LINEAGE'; END IF;
  -- Every evidence must be approved, active and reachable through the Pattern's movements (018 publication rule).
  IF (SELECT count(DISTINCT e.id) FROM brand_evidence e JOIN movement_evidence me ON me.evidence_id=e.id JOIN pattern_movements pm ON pm.movement_id=me.movement_id
      WHERE pm.pattern_id=p_pattern_id AND e.id=ANY(wanted) AND e.review_status='approved' AND e.status='active') <> cardinality(wanted) THEN RAISE EXCEPTION 'BW_SAVE:INELIGIBLE_LINEAGE'; END IF;
  IF EXISTS(SELECT 1 FROM brand_takes WHERE entity_id=p_entity_id AND pattern_id=p_pattern_id AND status='draft') THEN RAISE EXCEPTION 'BW_SAVE:DUPLICATE'; END IF;
  SELECT id INTO current_take FROM brand_takes WHERE entity_id=p_entity_id AND pattern_id=p_pattern_id AND status='published' LIMIT 1;
  IF current_take IS NOT NULL AND p_supersedes_id IS NULL THEN RAISE EXCEPTION 'BW_SAVE:REVISION_REQUIRED'; END IF;
  IF p_supersedes_id IS NOT NULL AND p_supersedes_id IS DISTINCT FROM current_take THEN RAISE EXCEPTION 'BW_SAVE:INVALID_PREDECESSOR'; END IF;
  INSERT INTO brand_takes(id,entity_id,pattern_id,what_we_see,why_it_may_matter,what_to_watch_next,confidence,uncertainties,revision,supersedes_id,status,generation_model,prompt_version,pipeline_version,created_at)
    VALUES(p_id,p_entity_id,p_pattern_id,p_what_we_see,p_why_it_may_matter,p_what_to_watch_next,p_confidence,coalesce(p_uncertainties,'{}'),p_revision,p_supersedes_id,'draft',p_generation_model,p_prompt_version,p_pipeline_version,p_generated_at);
  INSERT INTO take_evidence(entity_id,take_id,evidence_id) SELECT p_entity_id,p_id,x FROM unnest(wanted) x;
  RETURN jsonb_build_object('takeId',p_id,'noop',false);
END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_save_snapshot_draft(p_id uuid, p_entity_id uuid, p_headline text, p_body text, p_watch_next text, p_valid_from timestamptz, p_evidence_count integer, p_source_count integer, p_confidence numeric, p_uncertainties text[], p_revision integer, p_supersedes_id uuid, p_take_ids uuid[], p_generation_model text, p_prompt_version text, p_pipeline_version text, p_generated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE existing record; wanted uuid[] := (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_take_ids) x); current_snapshot uuid;
BEGIN
  PERFORM 1 FROM brand_entities WHERE id=p_entity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BW_SAVE:NOT_FOUND'; END IF;
  SELECT * INTO existing FROM brand_snapshots WHERE id=p_id;
  IF FOUND THEN
    IF existing.entity_id=p_entity_id AND existing.status='draft' AND (SELECT array_agg(take_id ORDER BY take_id) FROM snapshot_takes WHERE snapshot_id=p_id) = wanted
    THEN RETURN jsonb_build_object('snapshotId',p_id,'noop',true); END IF;
    RAISE EXCEPTION 'BW_SAVE:ID_CONFLICT';
  END IF;
  -- A stored snapshot is anchored to reviewed Takes; without them it could never be published or traced.
  IF coalesce(cardinality(wanted),0) = 0 THEN RAISE EXCEPTION 'BW_SAVE:LINEAGE_REQUIRED'; END IF;
  IF (SELECT count(*) FROM brand_takes WHERE id=ANY(wanted) AND entity_id=p_entity_id AND status='published') <> cardinality(wanted) THEN RAISE EXCEPTION 'BW_SAVE:INELIGIBLE_LINEAGE'; END IF;
  IF p_evidence_count <> (SELECT count(DISTINCT evidence_id) FROM take_evidence WHERE take_id=ANY(wanted))
    OR p_source_count <> (SELECT count(DISTINCT e.source_item_id) FROM take_evidence te JOIN brand_evidence e ON e.id=te.evidence_id WHERE te.take_id=ANY(wanted))
  THEN RAISE EXCEPTION 'BW_SAVE:COVERAGE_COUNT_MISMATCH'; END IF;
  IF EXISTS(SELECT 1 FROM brand_snapshots WHERE entity_id=p_entity_id AND status='draft') THEN RAISE EXCEPTION 'BW_SAVE:DUPLICATE'; END IF;
  IF (SELECT count(*) FROM brand_snapshots WHERE entity_id=p_entity_id AND status='published') > 1 THEN RAISE EXCEPTION 'BW_SAVE:AMBIGUOUS_PREDECESSOR'; END IF;
  SELECT id INTO current_snapshot FROM brand_snapshots WHERE entity_id=p_entity_id AND status='published';
  IF current_snapshot IS NOT NULL AND p_supersedes_id IS NULL THEN RAISE EXCEPTION 'BW_SAVE:REVISION_REQUIRED'; END IF;
  IF p_supersedes_id IS NOT NULL AND p_supersedes_id IS DISTINCT FROM current_snapshot THEN RAISE EXCEPTION 'BW_SAVE:INVALID_PREDECESSOR'; END IF;
  INSERT INTO brand_snapshots(id,entity_id,headline,body,watch_next,valid_from,valid_until,evidence_count,source_count,reviewed_by,reviewed_at,confidence,uncertainties,revision,supersedes_id,status,generation_model,prompt_version,pipeline_version,created_at)
    VALUES(p_id,p_entity_id,p_headline,p_body,p_watch_next,p_valid_from,NULL,p_evidence_count,p_source_count,NULL,NULL,p_confidence,coalesce(p_uncertainties,'{}'),p_revision,p_supersedes_id,'draft',p_generation_model,p_prompt_version,p_pipeline_version,p_generated_at);
  INSERT INTO snapshot_takes(entity_id,snapshot_id,take_id) SELECT p_entity_id,p_id,x FROM unnest(wanted) x;
  RETURN jsonb_build_object('snapshotId',p_id,'noop',false);
END $$;

-- Draft saves are server-side only: no anonymous/authenticated RPC surface.
REVOKE ALL ON FUNCTION public.brand_watch_save_pattern_draft(uuid,uuid,text,text,date,date,numeric,text[],integer,uuid,uuid[],text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_save_take_draft(uuid,uuid,uuid,text,text,text,numeric,text[],integer,uuid,uuid[],text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_save_snapshot_draft(uuid,uuid,text,text,text,timestamptz,integer,integer,numeric,text[],integer,uuid,uuid[],text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.brand_watch_save_pattern_draft(uuid,uuid,text,text,date,date,numeric,text[],integer,uuid,uuid[],text,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_save_take_draft(uuid,uuid,uuid,text,text,text,numeric,text[],integer,uuid,uuid[],text,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_watch_save_snapshot_draft(uuid,uuid,text,text,text,timestamptz,integer,integer,numeric,text[],integer,uuid,uuid[],text,text,text,timestamptz) TO service_role;
COMMIT;
