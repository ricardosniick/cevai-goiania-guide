-- Review/live preflight: SELECT jobname, schedule, command FROM cron.job;
-- Removes coordinates only. Does not delete places or reset fetched timestamps.
BEGIN;
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
DECLARE existing record; cron_zone text; daily_schedule text;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RAISE EXCEPTION 'pg_cron is missing: stop and inspect'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Run as database administrator able to inspect all cron jobs, not only own jobs';
  END IF;
  IF current_setting('cron.launch_active_jobs', true) = 'off' THEN
    RAISE EXCEPTION 'pg_cron job execution is disabled';
  END IF;
  -- Avoid silently adding a duplicate alongside an unknown/custom cleanup task.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname IS DISTINCT FROM 'clear-stale-place-coords'
    AND (command ILIKE '%clear_stale_place_coords%' OR
         (command ILIKE '%coords_fetched_at%' AND command ILIKE '%lat%' AND command ILIKE '%lng%'))) THEN
    RAISE EXCEPTION 'Equivalent cleanup job found under another name; review it instead of duplicating';
  END IF;
  cron_zone := coalesce(nullif(current_setting('cron.timezone', true), ''), 'GMT');
  IF cron_zone IN ('GMT', 'UTC', 'Etc/UTC', 'Etc/GMT') THEN daily_schedule := '0 6 * * *';
  ELSIF cron_zone = 'America/Sao_Paulo' THEN daily_schedule := '0 3 * * *';
  ELSE RAISE EXCEPTION 'Unsupported cron timezone: %, review schedule first', cron_zone;
  END IF;
  FOR existing IN SELECT jobid, command FROM cron.job WHERE jobname = 'clear-stale-place-coords' LOOP
    IF NOT (existing.command ILIKE '%clear_stale_place_coords%' OR
      (existing.command ILIKE '%coords_fetched_at%' AND existing.command ILIKE '%lat%' AND existing.command ILIKE '%lng%')) THEN
      RAISE EXCEPTION 'Job name collision with unrelated command; no job changed';
    END IF;
    PERFORM cron.unschedule(existing.jobid);
  END LOOP;
  PERFORM cron.schedule('clear-stale-place-coords', daily_schedule, 'SELECT public.clear_stale_place_coords();');
END;
$$;
COMMIT;

-- Postflight (run as migration owner, do not expect an invented zero):
-- SELECT jobname, schedule, command FROM cron.job WHERE jobname='clear-stale-place-coords';
-- SELECT public.clear_stale_place_coords() AS cleaned_rows;
-- SELECT jobid, status, return_message, start_time, end_time FROM cron.job_run_details
-- ORDER BY start_time DESC LIMIT 10;
