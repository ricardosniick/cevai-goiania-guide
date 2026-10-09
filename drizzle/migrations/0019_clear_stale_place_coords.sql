CREATE OR REPLACE FUNCTION public.clear_stale_place_coords()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE cleaned bigint;
BEGIN
  UPDATE public.places SET lat = NULL, lng = NULL
  WHERE (lat IS NOT NULL OR lng IS NOT NULL)
    AND (coords_fetched_at IS NULL OR coords_fetched_at < clock_timestamp() - interval '25 days');
  GET DIAGNOSTICS cleaned = ROW_COUNT;
  RETURN cleaned;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_stale_place_coords() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'clear-stale-place-coords' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
  -- 06:00 UTC = 03:00 Brasília
  PERFORM cron.schedule('clear-stale-place-coords', '0 6 * * *', 'SELECT public.clear_stale_place_coords();');
END;
$$;