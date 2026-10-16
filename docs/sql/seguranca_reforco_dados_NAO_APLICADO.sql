-- REVISÃO: não aplicado. Executar só com autorização, numa transação.
-- Corrige: (1) edição de notas de experiências públicas de outras pessoas;
-- (2) textos sem limite gravados direto pela API; (3) tipos de arquivo no bucket de fotos.
-- Não altera dados existentes (os limites já são respeitados: maior comentário 193, maior critério 15).
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.experience_scores'::regclass
                 AND polname = 'Scores follow experience' AND polpermissive) THEN
    RAISE EXCEPTION 'precheck: política auditada de experience_scores não encontrada';
  END IF;
  IF EXISTS (SELECT 1 FROM public.experiences WHERE char_length(comment) > 2000)
     OR EXISTS (SELECT 1 FROM public.experience_scores WHERE char_length(criterion) NOT BETWEEN 1 AND 60)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE char_length(full_name) > 120 OR char_length(avatar_url) > 2048) THEN
    RAISE EXCEPTION 'precheck: há dados acima dos novos limites; revisar antes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'experience-photos' AND public = false) THEN
    RAISE EXCEPTION 'precheck: bucket experience-photos deveria ser privado';
  END IF;
END;
$$;

-- (1) A política "Scores follow experience" (ALL) deixa o USING aceitar linhas de experiências
-- públicas de outras pessoas. Num UPDATE, o WITH CHECK só olha a linha nova, então dava para
-- mover a nota de outra pessoa para uma experiência própria. Restritiva = AND com as permissivas.
CREATE POLICY "Only owners update experience scores"
ON public.experience_scores AS RESTRICTIVE FOR UPDATE TO PUBLIC
USING (EXISTS (SELECT 1 FROM public.experiences e WHERE e.id = experience_scores.experience_id AND e.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.experiences e WHERE e.id = experience_scores.experience_id AND e.user_id = auth.uid()));

-- (2) As funções validam tamanho, mas INSERT/UPDATE direto pela API não passa por elas.
ALTER TABLE public.experiences ADD CONSTRAINT experiences_comment_len CHECK (comment IS NULL OR char_length(comment) <= 2000);
ALTER TABLE public.experience_scores ADD CONSTRAINT experience_scores_criterion_len CHECK (char_length(criterion) BETWEEN 1 AND 60);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_full_name_len CHECK (full_name IS NULL OR char_length(full_name) <= 120);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_len CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048);

-- (3) Só imagens comuns. Sem SVG (pode conter script) nem outros tipos de arquivo.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
WHERE id = 'experience-photos';
COMMIT;
