-- Nova função apenas; sem alteração em registros, tabelas ou políticas RLS existentes.
CREATE FUNCTION public.create_experience_once(
  _request_id uuid, _place_id text, _category text, _rating integer, _comment text,
  _would_return boolean, _stall_id uuid, _scores jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE s record; n integer := 0; experience_id uuid; existing public.experiences%ROWTYPE; existing_scores jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _request_id IS NULL THEN RAISE EXCEPTION 'bad_request_id'; END IF;
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'bad_rating'; END IF;
  IF _comment IS NOT NULL AND length(_comment) > 2000 THEN RAISE EXCEPTION 'bad_comment'; END IF;
  IF _scores IS NULL OR jsonb_typeof(_scores) <> 'object' THEN RAISE EXCEPTION 'bad_scores'; END IF;
  FOR s IN SELECT key, value FROM jsonb_each(_scores) LOOP
    n := n + 1;
    IF n > 12 OR length(trim(s.key)) = 0 OR length(s.key) > 60 THEN RAISE EXCEPTION 'bad_criterion'; END IF;
    IF jsonb_typeof(s.value) <> 'number' OR (s.value)::text !~ '^[1-5]$' THEN RAISE EXCEPTION 'bad_score'; END IF;
  END LOOP;

  -- Owner comes from the authenticated session. Existing RLS and constraints still apply.
  INSERT INTO public.experiences(id, user_id, place_id, category, rating, comment, would_return, stall_id, is_public)
  VALUES (_request_id, auth.uid(), _place_id, _category, _rating, nullif(trim(_comment), ''), coalesce(_would_return, true), _stall_id, false)
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO experience_id;

  IF experience_id IS NULL THEN
    SELECT * INTO existing FROM public.experiences WHERE id = _request_id AND user_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'request_conflict'; END IF;
    SELECT coalesce(jsonb_object_agg(criterion, score), '{}'::jsonb) INTO existing_scores
    FROM public.experience_scores sc WHERE sc.experience_id = _request_id;
    IF existing.place_id IS DISTINCT FROM _place_id
      OR existing.category IS DISTINCT FROM _category
      OR existing.rating IS DISTINCT FROM _rating
      OR existing.comment IS DISTINCT FROM nullif(trim(_comment), '')
      OR existing.would_return IS DISTINCT FROM coalesce(_would_return, true)
      OR existing.stall_id IS DISTINCT FROM _stall_id
      OR existing_scores IS DISTINCT FROM _scores
    THEN RAISE EXCEPTION 'request_conflict'; END IF;
    RETURN _request_id;
  END IF;

  INSERT INTO public.experience_scores(experience_id, criterion, score)
  SELECT experience_id, key, (value)::text::integer FROM jsonb_each(_scores);
  RETURN experience_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_experience_once(uuid, text, text, integer, text, boolean, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_experience_once(uuid, text, text, integer, text, boolean, uuid, jsonb) TO authenticated;
-- BEGIN/COMMIT do arquivo original removidos: a migração é aplicada integralmente em uma única transação pela ferramenta de migração.