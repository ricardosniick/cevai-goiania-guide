CREATE FUNCTION public.create_experience(
  _place_id text, _category text, _rating integer, _comment text,
  _would_return boolean, _stall_id uuid, _scores jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE s record; n integer := 0; experience_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'bad_rating'; END IF;
  IF _comment IS NOT NULL AND length(_comment) > 2000 THEN RAISE EXCEPTION 'bad_comment'; END IF;
  IF _scores IS NULL OR jsonb_typeof(_scores) <> 'object' THEN RAISE EXCEPTION 'bad_scores'; END IF;
  FOR s IN SELECT key, value FROM jsonb_each(_scores) LOOP
    n := n + 1;
    IF n > 12 OR length(trim(s.key)) = 0 OR length(s.key) > 60 THEN RAISE EXCEPTION 'bad_criterion'; END IF;
    IF jsonb_typeof(s.value) <> 'number' OR (s.value)::text !~ '^[1-5]$' THEN RAISE EXCEPTION 'bad_score'; END IF;
  END LOOP;

  -- Owner comes from the authenticated session. Existing RLS and constraints still apply.
  INSERT INTO public.experiences(user_id, place_id, category, rating, comment, would_return, stall_id, is_public)
  VALUES (auth.uid(), _place_id, _category, _rating, nullif(trim(_comment), ''), coalesce(_would_return, true), _stall_id, false)
  RETURNING id INTO experience_id;

  INSERT INTO public.experience_scores(experience_id, criterion, score)
  SELECT experience_id, key, (value)::text::integer FROM jsonb_each(_scores);
  RETURN experience_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_experience(text, text, integer, text, boolean, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_experience(text, text, integer, text, boolean, uuid, jsonb) TO authenticated;