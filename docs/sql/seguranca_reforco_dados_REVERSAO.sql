-- Reversão de seguranca_reforco_dados_NAO_APLICADO.sql
BEGIN;
DROP POLICY IF EXISTS "Only owners update experience scores" ON public.experience_scores;
ALTER TABLE public.experiences DROP CONSTRAINT IF EXISTS experiences_comment_len;
ALTER TABLE public.experience_scores DROP CONSTRAINT IF EXISTS experience_scores_criterion_len;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_full_name_len;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_len;
UPDATE storage.buckets SET allowed_mime_types = NULL WHERE id = 'experience-photos';
COMMIT;
