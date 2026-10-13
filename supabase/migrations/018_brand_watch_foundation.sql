-- Brand Watch foundation: LOCAL ONLY until separately approved for production.
-- No existing articles/insights triggers, policies or data are changed.
BEGIN;

CREATE TABLE IF NOT EXISTS public.brand_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), name text NOT NULL CHECK (btrim(name) <> ''), name_ko text NOT NULL, entity_type text NOT NULL CHECK (entity_type IN ('company','brand','service','sub_brand')), category text NOT NULL, subcategory text, description text, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_entities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_entities FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_entities TO service_role;

CREATE TABLE IF NOT EXISTS public.brand_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, alias text NOT NULL CHECK (btrim(alias) <> ''), normalized_alias text GENERATED ALWAYS AS (lower(regexp_replace(btrim(normalize(alias, NFKC)), '\s+', ' ', 'g'))) STORED UNIQUE, alias_type text NOT NULL CHECK (alias_type IN ('official','localized','common','historical')), language text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_aliases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_aliases TO service_role;

CREATE TABLE IF NOT EXISTS public.entity_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, to_entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, relation_type text NOT NULL CHECK (relation_type IN ('parent_of','owned_by','service_of','sub_brand_of','related_brand')), CHECK (from_entity_id <> to_entity_id), UNIQUE(from_entity_id,to_entity_id,relation_type),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.entity_relations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.entity_relations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_relations TO service_role;

CREATE TABLE IF NOT EXISTS public.brand_watch_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL UNIQUE REFERENCES brand_entities(id) ON DELETE RESTRICT, watch_status text NOT NULL DEFAULT 'paused' CHECK (watch_status IN ('active','paused','retired')), public_status text NOT NULL DEFAULT 'private' CHECK (public_status IN ('private','candidate','published')), seo_status text NOT NULL DEFAULT 'noindex' CHECK (seo_status IN ('noindex','candidate','index')), public_override boolean, seo_override boolean, override_reason text, last_meaningful_update_at timestamptz, last_reviewed_at timestamptz, current_snapshot_id uuid, CHECK ((public_override IS NULL AND seo_override IS NULL) OR nullif(btrim(override_reason),'') IS NOT NULL),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_watch_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_watch_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_watch_profiles TO service_role;

CREATE TABLE IF NOT EXISTS public.source_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, domain text NOT NULL UNIQUE, provider_type text NOT NULL CHECK (provider_type IN ('official_newsroom','official_blog','industry_media','business_media','official_social','other_media')), source_tier integer NOT NULL CHECK (source_tier BETWEEN 1 AND 3), reliability_policy text NOT NULL, active boolean NOT NULL DEFAULT false, ingestion_method text NOT NULL CHECK (ingestion_method IN ('manual','rss','api')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.source_providers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.source_providers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_providers TO service_role;

CREATE TABLE IF NOT EXISTS public.source_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES source_providers(id) ON DELETE RESTRICT, canonical_url text NOT NULL CHECK (canonical_url ~ '^https?://'), original_url text NOT NULL CHECK (original_url ~ '^https?://'), title text NOT NULL, published_at timestamptz, date_precision text NOT NULL CHECK (date_precision IN ('day','month','year','unknown')), author text, raw_text text, raw_html text, retention_until timestamptz, rights_basis text, content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'), image_url text, image_provenance text, collected_at timestamptz NOT NULL DEFAULT now(), existing_article_id uuid REFERENCES articles(id) ON DELETE SET NULL, status text NOT NULL DEFAULT 'collected' CHECK (status IN ('collected','reviewed','rejected','superseded')), UNIQUE(canonical_url,content_hash), CHECK ((raw_text IS NULL AND raw_html IS NULL) OR (retention_until IS NOT NULL AND nullif(btrim(rights_basis),'') IS NOT NULL)), CHECK (image_url IS NULL OR nullif(btrim(image_provenance),'') IS NOT NULL),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.source_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.source_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_items TO service_role;

CREATE TABLE IF NOT EXISTS public.source_entity_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id uuid NOT NULL REFERENCES source_items(id) ON DELETE RESTRICT, entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, role text NOT NULL CHECK (role IN ('primary','secondary','mentioned')), confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1), method text NOT NULL CHECK (method IN ('manual','alias','model')), review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')), UNIQUE(source_item_id,entity_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.source_entity_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.source_entity_matches FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_entity_matches TO service_role;

CREATE TABLE IF NOT EXISTS public.brand_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, source_item_id uuid NOT NULL REFERENCES source_items(id) ON DELETE RESTRICT, fact text NOT NULL CHECK (btrim(fact) <> ''), support_text text, support_locator text, event_date date, date_precision text NOT NULL CHECK (date_precision IN ('day','month','year','unknown')), marketing_relevance numeric NOT NULL CHECK (marketing_relevance BETWEEN 0 AND 1), confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1), extraction_method text NOT NULL CHECK (extraction_method IN ('manual','model')), review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')), status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','withdrawn')), supersedes_id uuid, correction_reason text, generation_model text, prompt_version text, pipeline_version text, UNIQUE(id,entity_id), FOREIGN KEY(supersedes_id,entity_id) REFERENCES brand_evidence(id,entity_id) ON DELETE RESTRICT, CHECK (supersedes_id IS NULL OR (supersedes_id <> id AND nullif(btrim(correction_reason),'') IS NOT NULL)), CHECK (nullif(btrim(support_text),'') IS NOT NULL OR nullif(btrim(support_locator),'') IS NOT NULL), CHECK (extraction_method <> 'model' OR (generation_model IS NOT NULL AND prompt_version IS NOT NULL AND pipeline_version IS NOT NULL)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_evidence TO service_role;

CREATE TABLE IF NOT EXISTS public.brand_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, event_key text NOT NULL, title text NOT NULL, summary text NOT NULL, movement_type text NOT NULL CHECK (movement_type IN ('campaign','creator','partnership','product','promotion','platform','brand')), scope text NOT NULL CHECK (scope IN ('local','national','global')), market text[] NOT NULL DEFAULT '{}', channel text[] NOT NULL DEFAULT '{}' CHECK (channel <@ ARRAY['online','offline','social','retail']::text[]), started_at timestamptz, last_observed_at timestamptz, importance integer NOT NULL CHECK (importance BETWEEN 1 AND 3), status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded','withdrawn')), merged_into_id uuid, UNIQUE(entity_id,event_key), UNIQUE(id,entity_id), FOREIGN KEY(merged_into_id,entity_id) REFERENCES brand_movements(id,entity_id) ON DELETE RESTRICT, CHECK (merged_into_id IS NULL OR (merged_into_id <> id AND status='superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_movements TO service_role;

CREATE TABLE IF NOT EXISTS public.movement_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, movement_id uuid NOT NULL, evidence_id uuid NOT NULL, FOREIGN KEY(movement_id,entity_id) REFERENCES brand_movements(id,entity_id) ON DELETE RESTRICT, FOREIGN KEY(evidence_id,entity_id) REFERENCES brand_evidence(id,entity_id) ON DELETE RESTRICT, UNIQUE(movement_id,evidence_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.movement_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.movement_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movement_evidence TO service_role;

CREATE TABLE IF NOT EXISTS public.themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE, name text NOT NULL, description text, status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','approved','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.themes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.themes TO service_role;

CREATE TABLE IF NOT EXISTS public.movement_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id uuid NOT NULL REFERENCES brand_movements(id) ON DELETE RESTRICT, theme_id uuid NOT NULL REFERENCES themes(id) ON DELETE RESTRICT, UNIQUE(movement_id,theme_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.movement_themes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.movement_themes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movement_themes TO service_role;

CREATE TABLE IF NOT EXISTS public.brand_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, title text NOT NULL, description text NOT NULL, window_start date NOT NULL, window_end date NOT NULL, confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1), CHECK (window_start <= window_end), revision integer NOT NULL DEFAULT 1 CHECK (revision > 0), supersedes_id uuid, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded','withdrawn')), generation_model text, prompt_version text, pipeline_version text, UNIQUE(id,entity_id), FOREIGN KEY(supersedes_id,entity_id) REFERENCES brand_patterns(id,entity_id) ON DELETE RESTRICT, CHECK (supersedes_id IS NULL OR supersedes_id <> id), CHECK ((generation_model IS NULL AND prompt_version IS NULL AND pipeline_version IS NULL) OR (generation_model IS NOT NULL AND prompt_version IS NOT NULL AND pipeline_version IS NOT NULL)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_patterns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_patterns FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_patterns TO service_role;

CREATE TABLE IF NOT EXISTS public.pattern_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, pattern_id uuid NOT NULL, movement_id uuid NOT NULL, FOREIGN KEY(pattern_id,entity_id) REFERENCES brand_patterns(id,entity_id) ON DELETE RESTRICT, FOREIGN KEY(movement_id,entity_id) REFERENCES brand_movements(id,entity_id) ON DELETE RESTRICT, UNIQUE(pattern_id,movement_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pattern_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pattern_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pattern_movements TO service_role;

CREATE TABLE IF NOT EXISTS public.brand_takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, pattern_id uuid NOT NULL, what_we_see text NOT NULL, why_it_may_matter text NOT NULL, what_to_watch_next text NOT NULL, FOREIGN KEY(pattern_id,entity_id) REFERENCES brand_patterns(id,entity_id) ON DELETE RESTRICT, revision integer NOT NULL DEFAULT 1 CHECK (revision > 0), supersedes_id uuid, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded','withdrawn')), generation_model text, prompt_version text, pipeline_version text, UNIQUE(id,entity_id), FOREIGN KEY(supersedes_id,entity_id) REFERENCES brand_takes(id,entity_id) ON DELETE RESTRICT, CHECK (supersedes_id IS NULL OR supersedes_id <> id), CHECK ((generation_model IS NULL AND prompt_version IS NULL AND pipeline_version IS NULL) OR (generation_model IS NOT NULL AND prompt_version IS NOT NULL AND pipeline_version IS NOT NULL)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_takes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_takes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_takes TO service_role;

CREATE TABLE IF NOT EXISTS public.take_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, take_id uuid NOT NULL, evidence_id uuid NOT NULL, FOREIGN KEY(take_id,entity_id) REFERENCES brand_takes(id,entity_id) ON DELETE RESTRICT, FOREIGN KEY(evidence_id,entity_id) REFERENCES brand_evidence(id,entity_id) ON DELETE RESTRICT, UNIQUE(take_id,evidence_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.take_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.take_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.take_evidence TO service_role;

CREATE TABLE IF NOT EXISTS public.brand_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, headline text NOT NULL, body text NOT NULL, valid_from timestamptz NOT NULL, valid_until timestamptz, evidence_count integer NOT NULL CHECK (evidence_count >= 0), source_count integer NOT NULL CHECK (source_count >= 0), reviewed_by text, reviewed_at timestamptz, CHECK (valid_until IS NULL OR valid_until > valid_from), revision integer NOT NULL DEFAULT 1 CHECK (revision > 0), supersedes_id uuid, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded','withdrawn')), generation_model text, prompt_version text, pipeline_version text, UNIQUE(id,entity_id), FOREIGN KEY(supersedes_id,entity_id) REFERENCES brand_snapshots(id,entity_id) ON DELETE RESTRICT, CHECK (supersedes_id IS NULL OR supersedes_id <> id), CHECK ((generation_model IS NULL AND prompt_version IS NULL AND pipeline_version IS NULL) OR (generation_model IS NOT NULL AND prompt_version IS NOT NULL AND pipeline_version IS NOT NULL)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_snapshots TO service_role;

CREATE TABLE IF NOT EXISTS public.snapshot_takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES brand_entities(id) ON DELETE RESTRICT, snapshot_id uuid NOT NULL, take_id uuid NOT NULL, FOREIGN KEY(snapshot_id,entity_id) REFERENCES brand_snapshots(id,entity_id) ON DELETE RESTRICT, FOREIGN KEY(take_id,entity_id) REFERENCES brand_takes(id,entity_id) ON DELETE RESTRICT, UNIQUE(snapshot_id,take_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.snapshot_takes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.snapshot_takes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snapshot_takes TO service_role;

CREATE TABLE IF NOT EXISTS public.brand_watch_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('entity','source','evidence','movement','theme','pattern','take','snapshot')), target_id uuid NOT NULL, action text NOT NULL CHECK (action IN ('approve','edit','reject','merge','split','supersede','publish','unpublish')), actor text NOT NULL CHECK (btrim(actor) <> ''), reason text NOT NULL CHECK (btrim(reason) <> ''), occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_watch_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_watch_review_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_watch_review_events TO service_role;

-- A profile can only point to its own snapshot. Re-run without duplicate constraints.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='brand_watch_current_snapshot_fk' AND conrelid='public.brand_watch_profiles'::regclass) THEN
    ALTER TABLE public.brand_watch_profiles ADD CONSTRAINT brand_watch_current_snapshot_fk
      FOREIGN KEY(current_snapshot_id,entity_id) REFERENCES public.brand_snapshots(id,entity_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS source_items_hash_idx ON public.source_items(content_hash);
CREATE INDEX IF NOT EXISTS source_items_provider_date_idx ON public.source_items(provider_id,published_at DESC);
CREATE INDEX IF NOT EXISTS brand_movements_recent_idx ON public.brand_movements(entity_id,last_observed_at DESC);
CREATE INDEX IF NOT EXISTS brand_evidence_source_idx ON public.brand_evidence(source_item_id);
CREATE INDEX IF NOT EXISTS review_events_target_idx ON public.brand_watch_review_events(target_type,target_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS brand_aliases_entity_id_idx ON public.brand_aliases(entity_id);
CREATE INDEX IF NOT EXISTS entity_relations_from_entity_id_idx ON public.entity_relations(from_entity_id);
CREATE INDEX IF NOT EXISTS entity_relations_to_entity_id_idx ON public.entity_relations(to_entity_id);
CREATE INDEX IF NOT EXISTS brand_watch_profiles_entity_id_idx ON public.brand_watch_profiles(entity_id);
CREATE INDEX IF NOT EXISTS source_items_provider_id_idx ON public.source_items(provider_id);
CREATE INDEX IF NOT EXISTS source_entity_matches_source_item_id_idx ON public.source_entity_matches(source_item_id);
CREATE INDEX IF NOT EXISTS source_entity_matches_entity_id_idx ON public.source_entity_matches(entity_id);
CREATE INDEX IF NOT EXISTS brand_evidence_entity_id_idx ON public.brand_evidence(entity_id);
CREATE INDEX IF NOT EXISTS brand_evidence_source_item_id_idx ON public.brand_evidence(source_item_id);
CREATE INDEX IF NOT EXISTS brand_movements_entity_id_idx ON public.brand_movements(entity_id);
CREATE INDEX IF NOT EXISTS movement_evidence_entity_id_idx ON public.movement_evidence(entity_id);
CREATE INDEX IF NOT EXISTS movement_evidence_movement_id_idx ON public.movement_evidence(movement_id);
CREATE INDEX IF NOT EXISTS movement_evidence_evidence_id_idx ON public.movement_evidence(evidence_id);
CREATE INDEX IF NOT EXISTS movement_themes_movement_id_idx ON public.movement_themes(movement_id);
CREATE INDEX IF NOT EXISTS movement_themes_theme_id_idx ON public.movement_themes(theme_id);
CREATE INDEX IF NOT EXISTS brand_patterns_entity_id_idx ON public.brand_patterns(entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS brand_patterns_successor_idx ON public.brand_patterns(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pattern_movements_entity_id_idx ON public.pattern_movements(entity_id);
CREATE INDEX IF NOT EXISTS pattern_movements_pattern_id_idx ON public.pattern_movements(pattern_id);
CREATE INDEX IF NOT EXISTS pattern_movements_movement_id_idx ON public.pattern_movements(movement_id);
CREATE INDEX IF NOT EXISTS brand_takes_entity_id_idx ON public.brand_takes(entity_id);
CREATE INDEX IF NOT EXISTS brand_takes_pattern_id_idx ON public.brand_takes(pattern_id);
CREATE UNIQUE INDEX IF NOT EXISTS brand_takes_successor_idx ON public.brand_takes(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS take_evidence_entity_id_idx ON public.take_evidence(entity_id);
CREATE INDEX IF NOT EXISTS take_evidence_take_id_idx ON public.take_evidence(take_id);
CREATE INDEX IF NOT EXISTS take_evidence_evidence_id_idx ON public.take_evidence(evidence_id);
CREATE INDEX IF NOT EXISTS brand_snapshots_entity_id_idx ON public.brand_snapshots(entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS brand_snapshots_successor_idx ON public.brand_snapshots(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS snapshot_takes_entity_id_idx ON public.snapshot_takes(entity_id);
CREATE INDEX IF NOT EXISTS snapshot_takes_snapshot_id_idx ON public.snapshot_takes(snapshot_id);
CREATE INDEX IF NOT EXISTS snapshot_takes_take_id_idx ON public.snapshot_takes(take_id);
CREATE INDEX IF NOT EXISTS brand_watch_review_events_target_id_idx ON public.brand_watch_review_events(target_id);

-- Published payloads and their junctions are frozen. Correction creates a successor.
CREATE OR REPLACE FUNCTION public.brand_watch_guard_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE previous record;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'Published history cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.status <> 'draft' THEN
    IF NEW.status NOT IN (OLD.status,'superseded','withdrawn')
       OR (to_jsonb(NEW)-'status'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'updated_at')
    THEN RAISE EXCEPTION 'Published payload is immutable; create a revision'; END IF;
  END IF;
  IF NEW.supersedes_id IS NOT NULL THEN
    EXECUTE format('SELECT revision,status FROM public.%I WHERE id=$1',TG_TABLE_NAME) INTO previous USING NEW.supersedes_id;
    IF previous.revision IS NULL OR NEW.revision <> previous.revision+1 OR previous.status='draft' THEN RAISE EXCEPTION 'Invalid predecessor revision'; END IF;
  ELSIF NEW.revision <> 1 THEN RAISE EXCEPTION 'First revision must be 1';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_guard_links()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE owner_status text; row_data jsonb;
BEGIN
  -- Check OLD and NEW owners so moving a link cannot mutate an old publication.
  FOR row_data IN SELECT value FROM jsonb_array_elements(
    CASE WHEN TG_OP='INSERT' THEN jsonb_build_array(to_jsonb(NEW))
         WHEN TG_OP='DELETE' THEN jsonb_build_array(to_jsonb(OLD))
         ELSE jsonb_build_array(to_jsonb(OLD),to_jsonb(NEW)) END)
  LOOP
    EXECUTE format('SELECT status FROM public.%I WHERE id=$1',TG_ARGV[0])
      INTO owner_status USING (row_data->>TG_ARGV[1])::uuid;
    IF owner_status <> 'draft' THEN RAISE EXCEPTION 'Published lineage is immutable'; END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- Deferred checks allow inserting a draft and its links, then publishing in one transaction.
CREATE OR REPLACE FUNCTION public.brand_watch_validate_publication()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE current_row record;
BEGIN
  EXECUTE format('SELECT * FROM public.%I WHERE id=$1',TG_TABLE_NAME) INTO current_row USING NEW.id;
  IF current_row.status IS DISTINCT FROM 'published' THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME='brand_movements' THEN
    IF NOT EXISTS (SELECT 1 FROM movement_evidence WHERE movement_id=current_row.id) OR EXISTS (
      SELECT 1 FROM movement_evidence me JOIN brand_evidence e ON e.id=me.evidence_id
      WHERE me.movement_id=current_row.id AND (e.review_status <> 'approved' OR e.status <> 'active' OR NOT EXISTS (
        SELECT 1 FROM source_entity_matches sm WHERE sm.source_item_id=e.source_item_id
        AND sm.entity_id=e.entity_id AND sm.role='primary' AND sm.review_status='approved'
      ))) THEN RAISE EXCEPTION 'Movement requires approved primary-action evidence'; END IF;
  ELSIF TG_TABLE_NAME='brand_patterns' THEN
    IF (SELECT count(DISTINCT m.event_key) FROM pattern_movements pm JOIN brand_movements m ON m.id=pm.movement_id
        WHERE pm.pattern_id=current_row.id AND m.status='published') < 2
      OR EXISTS(SELECT 1 FROM pattern_movements pm JOIN brand_movements m ON m.id=pm.movement_id WHERE pm.pattern_id=current_row.id AND m.status <> 'published')
    THEN RAISE EXCEPTION 'Pattern requires two independent published movements'; END IF;
  ELSIF TG_TABLE_NAME='brand_takes' THEN
    IF NOT EXISTS(SELECT 1 FROM brand_patterns WHERE id=current_row.pattern_id AND status='published')
      OR NOT EXISTS(SELECT 1 FROM take_evidence WHERE take_id=current_row.id)
      OR EXISTS(SELECT 1 FROM take_evidence te WHERE te.take_id=current_row.id AND NOT EXISTS (
        SELECT 1 FROM pattern_movements pm JOIN movement_evidence me ON me.movement_id=pm.movement_id
        WHERE pm.pattern_id=current_row.pattern_id AND me.evidence_id=te.evidence_id
      )) THEN RAISE EXCEPTION 'Take requires reachable pattern evidence'; END IF;
  ELSIF TG_TABLE_NAME='brand_snapshots' THEN
    IF current_row.reviewed_at IS NULL OR current_row.reviewed_by IS NULL OR NOT EXISTS(SELECT 1 FROM snapshot_takes WHERE snapshot_id=current_row.id)
      OR EXISTS(SELECT 1 FROM snapshot_takes st JOIN brand_takes t ON t.id=st.take_id WHERE st.snapshot_id=current_row.id AND t.status <> 'published')
    THEN RAISE EXCEPTION 'Snapshot requires reviewed published takes'; END IF;
    IF current_row.evidence_count <> (SELECT count(DISTINCT te.evidence_id) FROM snapshot_takes st JOIN take_evidence te ON te.take_id=st.take_id WHERE st.snapshot_id=current_row.id)
      OR current_row.source_count <> (SELECT count(DISTINCT e.source_item_id) FROM snapshot_takes st JOIN take_evidence te ON te.take_id=st.take_id JOIN brand_evidence e ON e.id=te.evidence_id WHERE st.snapshot_id=current_row.id)
    THEN RAISE EXCEPTION 'Snapshot coverage counts must match lineage'; END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.brand_watch_guard_audit()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Review events are append-only'; END $$;

CREATE OR REPLACE FUNCTION public.brand_watch_guard_fact()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE locked boolean;
BEGIN
  IF TG_TABLE_NAME='brand_movements' THEN locked := OLD.status <> 'draft';
  ELSE locked := OLD.review_status='approved' OR OLD.status <> 'active'; END IF;
  IF locked THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Reviewed fact history cannot be deleted'; END IF;
    IF (to_jsonb(NEW)-'status'-'review_status'-'updated_at'-'merged_into_id') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'review_status'-'updated_at'-'merged_into_id')
      OR (OLD.status <> 'active' AND OLD.status <> 'draft' AND NEW.status IN ('active','draft'))
    THEN RAISE EXCEPTION 'Reviewed fact payload is immutable; supersede instead'; END IF;
    IF TG_TABLE_NAME='brand_evidence' THEN
      IF OLD.review_status='approved' AND NEW.review_status <> 'approved'
      THEN RAISE EXCEPTION 'Approved evidence must be withdrawn or superseded, not reset'; END IF;
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.brand_watch_guard_source()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF (to_jsonb(NEW)-'raw_text'-'raw_html'-'retention_until'-'rights_basis'-'status'-'updated_at'-'existing_article_id') IS DISTINCT FROM
     (to_jsonb(OLD)-'raw_text'-'raw_html'-'retention_until'-'rights_basis'-'status'-'updated_at'-'existing_article_id')
  THEN RAISE EXCEPTION 'Source version is immutable; collect new content hash'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.brand_watch_validate_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.current_snapshot_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM brand_snapshots WHERE id=NEW.current_snapshot_id AND entity_id=NEW.entity_id AND status='published')
  THEN RAISE EXCEPTION 'Current snapshot must be a published same-entity revision'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bw_profile ON public.brand_watch_profiles;
CREATE TRIGGER bw_profile BEFORE INSERT OR UPDATE ON public.brand_watch_profiles FOR EACH ROW EXECUTE FUNCTION public.brand_watch_validate_profile();
DROP TRIGGER IF EXISTS bw_source ON public.source_items;
CREATE TRIGGER bw_source BEFORE UPDATE ON public.source_items FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_source();
DROP TRIGGER IF EXISTS bw_fact ON public.brand_evidence;
CREATE TRIGGER bw_fact BEFORE UPDATE OR DELETE ON public.brand_evidence FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_fact();
DROP TRIGGER IF EXISTS bw_fact ON public.brand_movements;
CREATE TRIGGER bw_fact BEFORE UPDATE OR DELETE ON public.brand_movements FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_fact();
DROP TRIGGER IF EXISTS bw_touch ON public.brand_entities;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.brand_entities FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.brand_aliases;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.brand_aliases FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.entity_relations;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.entity_relations FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.brand_watch_profiles;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.brand_watch_profiles FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.source_providers;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.source_providers FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.source_items;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.source_items FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.source_entity_matches;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.source_entity_matches FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.brand_evidence;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.brand_evidence FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.brand_movements;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.brand_movements FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_publication ON public.brand_movements;
CREATE CONSTRAINT TRIGGER bw_publication AFTER INSERT OR UPDATE ON public.brand_movements DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.brand_watch_validate_publication();
DROP TRIGGER IF EXISTS bw_touch ON public.movement_evidence;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.movement_evidence FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.themes;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.themes FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.movement_themes;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.movement_themes FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.brand_patterns;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.brand_patterns FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_revision ON public.brand_patterns;
CREATE TRIGGER bw_revision BEFORE INSERT OR UPDATE OR DELETE ON public.brand_patterns FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_revision();
DROP TRIGGER IF EXISTS bw_publication ON public.brand_patterns;
CREATE CONSTRAINT TRIGGER bw_publication AFTER INSERT OR UPDATE ON public.brand_patterns DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.brand_watch_validate_publication();
DROP TRIGGER IF EXISTS bw_touch ON public.pattern_movements;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.pattern_movements FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.brand_takes;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.brand_takes FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_revision ON public.brand_takes;
CREATE TRIGGER bw_revision BEFORE INSERT OR UPDATE OR DELETE ON public.brand_takes FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_revision();
DROP TRIGGER IF EXISTS bw_publication ON public.brand_takes;
CREATE CONSTRAINT TRIGGER bw_publication AFTER INSERT OR UPDATE ON public.brand_takes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.brand_watch_validate_publication();
DROP TRIGGER IF EXISTS bw_touch ON public.take_evidence;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.take_evidence FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_touch ON public.brand_snapshots;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.brand_snapshots FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_revision ON public.brand_snapshots;
CREATE TRIGGER bw_revision BEFORE INSERT OR UPDATE OR DELETE ON public.brand_snapshots FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_revision();
DROP TRIGGER IF EXISTS bw_publication ON public.brand_snapshots;
CREATE CONSTRAINT TRIGGER bw_publication AFTER INSERT OR UPDATE ON public.brand_snapshots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.brand_watch_validate_publication();
DROP TRIGGER IF EXISTS bw_touch ON public.snapshot_takes;
CREATE TRIGGER bw_touch BEFORE UPDATE ON public.snapshot_takes FOR EACH ROW EXECUTE FUNCTION public.brand_watch_touch();
DROP TRIGGER IF EXISTS bw_audit_immutable ON public.brand_watch_review_events;
CREATE TRIGGER bw_audit_immutable BEFORE UPDATE OR DELETE ON public.brand_watch_review_events FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_audit();
DROP TRIGGER IF EXISTS bw_links ON public.movement_evidence;
CREATE TRIGGER bw_links BEFORE INSERT OR UPDATE OR DELETE ON public.movement_evidence FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_links('brand_movements','movement_id');
DROP TRIGGER IF EXISTS bw_links ON public.movement_themes;
CREATE TRIGGER bw_links BEFORE INSERT OR UPDATE OR DELETE ON public.movement_themes FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_links('brand_movements','movement_id');
DROP TRIGGER IF EXISTS bw_links ON public.pattern_movements;
CREATE TRIGGER bw_links BEFORE INSERT OR UPDATE OR DELETE ON public.pattern_movements FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_links('brand_patterns','pattern_id');
DROP TRIGGER IF EXISTS bw_links ON public.take_evidence;
CREATE TRIGGER bw_links BEFORE INSERT OR UPDATE OR DELETE ON public.take_evidence FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_links('brand_takes','take_id');
DROP TRIGGER IF EXISTS bw_links ON public.snapshot_takes;
CREATE TRIGGER bw_links BEFORE INSERT OR UPDATE OR DELETE ON public.snapshot_takes FOR EACH ROW EXECUTE FUNCTION public.brand_watch_guard_links('brand_snapshots','snapshot_id');
-- Trigger functions are not an anonymous RPC surface.
REVOKE ALL ON FUNCTION public.brand_watch_guard_revision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_guard_links() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_validate_publication() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_touch() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_guard_audit() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_guard_fact() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_guard_source() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.brand_watch_validate_profile() FROM PUBLIC,anon,authenticated;
REVOKE UPDATE,DELETE ON public.brand_watch_review_events FROM service_role;
COMMIT;
