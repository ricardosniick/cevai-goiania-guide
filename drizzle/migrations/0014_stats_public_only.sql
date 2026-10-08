BEGIN;
CREATE OR REPLACE FUNCTION public.place_experience_stats(_place_ids text[])
 RETURNS TABLE(place_id text, avg_rating numeric, experience_count bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.place_id, round(avg(e.rating)::numeric, 1), count(*)
  FROM public.experiences e
  WHERE e.place_id = ANY(_place_ids) AND e.stall_id IS NULL AND e.is_public
  GROUP BY e.place_id
$function$;
CREATE OR REPLACE FUNCTION public.stall_experience_stats(_stall_ids uuid[])
 RETURNS TABLE(stall_id uuid, avg_rating numeric, experience_count bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.stall_id, round(avg(e.rating)::numeric, 1), count(*)
  FROM public.experiences e
  WHERE e.stall_id = ANY(_stall_ids) AND e.is_public
  GROUP BY e.stall_id
$function$;
COMMIT;