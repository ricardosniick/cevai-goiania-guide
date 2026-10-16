-- Reversão de seguranca_reforco_dados_NAO_APLICADO.sql
-- Usar apenas para reverter esta aplicação, nunca como limpeza genérica.
BEGIN;
DO $$
DECLARE item record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p WHERE p.polrelid = 'public.experience_scores'::regclass
      AND p.polname = 'Only owners update experience scores'
      AND obj_description(p.oid, 'pg_policy') = 'cevai-security-20261016-v1'
  ) THEN RAISE EXCEPTION 'rollback: política não foi criada por esta versão'; END IF;
  FOR item IN SELECT * FROM (VALUES
    ('public.experiences', 'experiences_comment_len'),
    ('public.experience_scores', 'experience_scores_criterion_len'),
    ('public.profiles', 'profiles_full_name_len'),
    ('public.profiles', 'profiles_avatar_url_len')
  ) AS expected(table_name, constraint_name) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c WHERE c.conrelid = item.table_name::regclass
        AND c.conname = item.constraint_name
        AND obj_description(c.oid, 'pg_constraint') = 'cevai-security-20261016-v1'
    ) THEN RAISE EXCEPTION 'rollback: constraint ausente ou de outra versão: %', item.constraint_name; END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'experience-photos' AND public = false
      AND allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']::text[]
  ) THEN RAISE EXCEPTION 'rollback: configuração de MIME mudou; parar e revisar'; END IF;
END;
$$;
DROP POLICY IF EXISTS "Only owners update experience scores" ON public.experience_scores;
ALTER TABLE public.experiences DROP CONSTRAINT IF EXISTS experiences_comment_len;
ALTER TABLE public.experience_scores DROP CONSTRAINT IF EXISTS experience_scores_criterion_len;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_full_name_len;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_len;
UPDATE storage.buckets SET allowed_mime_types = NULL WHERE id = 'experience-photos';
COMMIT;
