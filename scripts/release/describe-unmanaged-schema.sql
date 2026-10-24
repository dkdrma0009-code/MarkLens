-- MarkLens release (R-3): what production really has for the parts no repository migration defines.
-- READ ONLY — one SELECT over system catalogs. It reads no application data (the only rows outside the catalogs are bucket
-- names and their public flag from storage.buckets), writes nothing, changes no setting and calls only catalog/formatting
-- functions. String literals inside policy expressions are masked ('…') so a policy that names an
-- address cannot leak it. Run it in the PRODUCTION SQL Editor (approved as step B), download the result as CSV, then:
--   node scripts/release/compare-unmanaged-schema.mjs <downloaded.csv> <check-production-schema.csv>
-- which runs this same query on the Preview bundle (PGlite) and lists every difference.
-- Scope: the 7 dashboard-made tables, the 4 hand-added insights columns, random_quiz(), functions/views/foreign keys
-- that depend on those tables, and the storage buckets.
WITH t(name) AS (VALUES ('app_config'), ('cardnews'), ('feedback'), ('follower_snapshots'), ('quiz_questions'), ('site_feedback'), ('competitions')),
rel AS (
  SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname IN (SELECT name FROM t)
),
fn AS (
  SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef, p.provolatile, p.proowner, p.proacl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'random_quiz'
),
rows(section, object, name, detail) AS (
  SELECT '0 table', t.name, '', CASE WHEN r.oid IS NULL THEN 'MISSING' ELSE 'present' END FROM t LEFT JOIN rel r ON r.relname = t.name
  UNION ALL
  SELECT '1 column', c.relname, a.attname, concat_ws(' ', format_type(a.atttypid, a.atttypmod), CASE WHEN a.attnotnull THEN 'NOT NULL' END,
    CASE WHEN d.adbin IS NOT NULL THEN 'DEFAULT ' || pg_get_expr(d.adbin, d.adrelid) END, CASE WHEN a.attidentity <> '' THEN 'IDENTITY ' || a.attidentity::text END)
  FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
    AND (c.oid IN (SELECT oid FROM rel) OR (c.relname = 'insights' AND a.attname IN ('hook', 'marketing_terms', 'quiz', 'video_url')))
  UNION ALL
  SELECT '2 constraint', r.relname, k.conname, pg_get_constraintdef(k.oid) FROM pg_constraint k JOIN rel r ON r.oid = k.conrelid
  UNION ALL
  SELECT '3 referenced by', r.relname, c.relname || '.' || k.conname, pg_get_constraintdef(k.oid)
  FROM pg_constraint k JOIN rel r ON r.oid = k.confrelid JOIN pg_class c ON c.oid = k.conrelid WHERE k.contype = 'f' AND k.conrelid <> k.confrelid
  UNION ALL
  SELECT '4 index', i.tablename, i.indexname, i.indexdef FROM pg_indexes i WHERE i.schemaname = 'public' AND i.tablename IN (SELECT name FROM t)
  UNION ALL
  SELECT '5 trigger', r.relname, g.tgname, pg_get_triggerdef(g.oid) FROM pg_trigger g JOIN rel r ON r.oid = g.tgrelid WHERE NOT g.tgisinternal
  UNION ALL
  SELECT '6 rls', r.relname, '', concat_ws(' ', CASE WHEN r.relrowsecurity THEN 'enabled' ELSE 'disabled' END, CASE WHEN r.relforcerowsecurity THEN 'forced' END) FROM rel r
  UNION ALL
  SELECT '7 policy', p.tablename, p.policyname, concat_ws(' ', p.cmd, p.permissive, 'TO ' || array_to_string(p.roles, ','),
    'USING ' || regexp_replace(p.qual, '''[^'']*''', '''…''', 'g'), 'CHECK ' || regexp_replace(p.with_check, '''[^'']*''', '''…''', 'g'))
  FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename IN (SELECT name FROM t)
  UNION ALL
  SELECT '8 grant', g.table_name, g.grantee, string_agg(g.privilege_type, ', ' ORDER BY g.privilege_type)
  FROM information_schema.role_table_grants g
  WHERE g.table_schema = 'public' AND g.table_name IN (SELECT name FROM t) AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
  GROUP BY g.table_name, g.grantee
  UNION ALL
  SELECT '9 function', f.proname, f.args, concat_ws(' ', 'RETURNS ' || pg_get_function_result(f.oid), l.lanname,
    CASE f.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' ELSE 'VOLATILE' END, CASE WHEN f.prosecdef THEN 'SECURITY DEFINER' END)
  FROM fn f JOIN pg_proc p ON p.oid = f.oid JOIN pg_language l ON l.oid = p.prolang
  UNION ALL
  SELECT '9 function body', f.proname, f.args, btrim(regexp_replace(p.prosrc, '\s+', ' ', 'g')) FROM fn f JOIN pg_proc p ON p.oid = f.oid
  UNION ALL
  SELECT '9 function execute', f.proname, CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END, 'EXECUTE'
  FROM fn f, aclexplode(COALESCE(f.proacl, acldefault('f', f.proowner))) x
  WHERE x.privilege_type = 'EXECUTE' AND (x.grantee = 0 OR pg_get_userbyid(x.grantee) IN ('anon', 'authenticated', 'service_role'))
  UNION ALL
  SELECT DISTINCT '10 dependent function', t.name, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'invoker' END
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN t ON p.prosrc ~ ('\m' || t.name || '\M')
  WHERE n.nspname = 'public' AND p.proname <> 'random_quiz'
  UNION ALL
  SELECT DISTINCT '11 dependent view', r.relname, v.relname, v.relkind::text
  FROM pg_depend d JOIN pg_rewrite w ON w.oid = d.objid JOIN pg_class v ON v.oid = w.ev_class JOIN rel r ON r.oid = d.refobjid WHERE v.oid <> r.oid
  UNION ALL
  SELECT '12 bucket', b.id, '', CASE WHEN b.public THEN 'public' ELSE 'private' END FROM storage.buckets b
)
-- The last row carries the row count, so a download cut short by the SQL Editor's row limit is detected.
SELECT section, object, name, detail FROM (
  SELECT section, object, name, detail FROM rows UNION ALL SELECT '99 end', 'rows', '', (SELECT count(*) FROM rows)::text
) described ORDER BY section, object, name, detail;
