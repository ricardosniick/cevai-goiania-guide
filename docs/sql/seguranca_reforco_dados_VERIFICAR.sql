-- Somente leitura. Executar antes e depois da aplicação, sem conteúdo pessoal.
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'experience_scores'
ORDER BY policyname;

SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('public.experiences'::regclass, 'public.experience_scores'::regclass, 'public.profiles'::regclass)
  AND conname IN ('experiences_comment_len','experience_scores_criterion_len','profiles_full_name_len','profiles_avatar_url_len')
ORDER BY conname;

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'experience-photos';

SELECT
  (SELECT count(*) FROM public.experiences WHERE char_length(comment) > 2000) AS comments_too_long,
  (SELECT count(*) FROM public.experience_scores WHERE char_length(criterion) NOT BETWEEN 1 AND 60) AS invalid_criterion_length,
  (SELECT count(*) FROM public.profiles WHERE char_length(full_name) > 120 OR char_length(avatar_url) > 2048) AS profiles_too_long;
