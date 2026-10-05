CREATE OR REPLACE FUNCTION public.update_experience(_id uuid, _rating integer, _comment text, _would_return boolean, _is_public boolean, _scores jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s record; n int := 0;
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
  UPDATE public.experiences
    SET rating = _rating, comment = nullif(trim(_comment), ''), would_return = coalesce(_would_return, true), is_public = coalesce(_is_public, false)
    WHERE id = _id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  DELETE FROM public.experience_scores WHERE experience_id = _id;
  INSERT INTO public.experience_scores(experience_id, criterion, score)
    SELECT _id, key, (value)::text::int FROM jsonb_each(_scores);
END $$;
REVOKE ALL ON FUNCTION public.update_experience(uuid, integer, text, boolean, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_experience(uuid, integer, text, boolean, boolean, jsonb) TO authenticated;