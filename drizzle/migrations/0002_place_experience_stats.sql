CREATE OR REPLACE FUNCTION public.place_experience_stats(_place_ids text[])
RETURNS TABLE(place_id text, avg_rating numeric, experience_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.place_id, round(avg(e.rating)::numeric, 1), count(*)
  FROM public.experiences e
  WHERE e.place_id = ANY(_place_ids)
  GROUP BY e.place_id
$$;
REVOKE ALL ON FUNCTION public.place_experience_stats(text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.place_experience_stats(text[]) TO authenticated;