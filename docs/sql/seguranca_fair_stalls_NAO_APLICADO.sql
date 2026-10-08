-- REVIEW ONLY. Publish the client that stops selecting created_by BEFORE applying this SQL.
-- Metadata precondition: audited table/column grants, no existing column ACLs.
BEGIN;
DO $$
DECLARE role_name text; privilege_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='fair_stalls' AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'precheck: fair_stalls RLS not enabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.fair_stalls'::regclass AND attnum>0 AND NOT attisdropped AND coalesce(cardinality(attacl),0)>0) THEN
    RAISE EXCEPTION 'precheck: existing column grants require exact review and rollback';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF NOT has_table_privilege(role_name,'public.fair_stalls',privilege_name) THEN
        RAISE EXCEPTION 'precheck: % % differs from audited ALL grants', role_name, privilege_name;
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.fair_stalls'::regclass AND a.grantee=0) THEN
    RAISE EXCEPTION 'precheck: PUBLIC grants differ from audit';
  END IF;
END $$;

REVOKE ALL PRIVILEGES ON public.fair_stalls FROM anon;
REVOKE SELECT ON public.fair_stalls FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.fair_stalls FROM authenticated;
GRANT SELECT (id, place_id, name, kind, emoji, created_at) ON public.fair_stalls TO authenticated;
-- INSERT/UPDATE/DELETE continue through the unchanged creator-only RLS policies.

DO $$
BEGIN
  IF has_column_privilege('authenticated','public.fair_stalls','created_by','SELECT') THEN
    RAISE EXCEPTION 'postcheck: creator ID still readable';
  END IF;
  IF NOT has_column_privilege('authenticated','public.fair_stalls','name','SELECT')
    OR NOT has_column_privilege('authenticated','public.fair_stalls','created_at','SELECT') THEN
    RAISE EXCEPTION 'postcheck: catalog unreadable';
  END IF;
  IF has_table_privilege('anon','public.fair_stalls','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    OR has_column_privilege('anon','public.fair_stalls','created_by','SELECT') THEN
    RAISE EXCEPTION 'postcheck: anonymous privilege remains';
  END IF;
END $$;
COMMIT;
