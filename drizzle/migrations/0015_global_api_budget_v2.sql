CREATE TABLE public.global_api_limits (
  bucket      text PRIMARY KEY
              CHECK (bucket IN ('text_search','nearby_search','details_full','details_basic','photo')),
  per_minute  integer NOT NULL CHECK (per_minute > 0),
  per_day     integer NOT NULL CHECK (per_day > 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (per_minute <= per_day)
);

CREATE TABLE public.global_api_usage (
  bucket       text        NOT NULL,
  window_kind  text        NOT NULL CHECK (window_kind IN ('minute','day')),
  window_start timestamptz NOT NULL,
  used         integer     NOT NULL CHECK (used >= 0),
  PRIMARY KEY (bucket, window_kind, window_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_api_limits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_api_usage  TO service_role;
REVOKE ALL ON public.global_api_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.global_api_usage  FROM PUBLIC, anon, authenticated;
ALTER TABLE public.global_api_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_api_usage ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.global_budget_clock()
RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path TO 'public'
AS $$ SELECT clock_timestamp() $$;
REVOKE ALL ON FUNCTION public.global_budget_clock() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.reserve_global_budget(_bucket text, _requested integer, _allow_partial boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lim      record;
  ts       timestamptz;
  m_start  timestamptz;
  d_start  timestamptz;
  used_m   integer;
  used_d   integer;
  granted  integer;
BEGIN
  IF _bucket IS NULL OR _bucket NOT IN ('text_search','nearby_search','details_full','details_basic','photo') THEN
    RAISE EXCEPTION 'bad_bucket';
  END IF;
  IF _requested IS NULL OR _requested < 1 OR _requested > 50 THEN
    RAISE EXCEPTION 'bad_requested';
  END IF;
  IF _allow_partial IS NULL THEN
    RAISE EXCEPTION 'bad_partial';
  END IF;
  IF _allow_partial AND _bucket <> 'photo' THEN
    RAISE EXCEPTION 'partial_not_allowed';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('global_budget:' || _bucket, 0));

  SELECT per_minute, per_day INTO lim FROM public.global_api_limits WHERE bucket = _bucket FOR SHARE;
  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  ts      := public.global_budget_clock();
  m_start := date_trunc('minute', ts AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  d_start := date_trunc('day', ts AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';

  DELETE FROM public.global_api_usage
    WHERE bucket = _bucket
     AND ((window_kind = 'minute' AND window_start < m_start)
       OR (window_kind = 'day'    AND window_start < d_start - interval '2 days'));

  SELECT coalesce(max(used) FILTER (WHERE window_kind = 'minute' AND window_start = m_start), 0),
         coalesce(max(used) FILTER (WHERE window_kind = 'day'    AND window_start = d_start), 0)
    INTO used_m, used_d
    FROM public.global_api_usage
   WHERE bucket = _bucket AND window_start IN (m_start, d_start);

  granted := least(_requested, lim.per_minute - used_m, lim.per_day - used_d);
  IF granted <= 0 THEN
    RETURN 0;
  END IF;
  IF granted < _requested AND NOT _allow_partial THEN
    RETURN 0;
  END IF;

  INSERT INTO public.global_api_usage(bucket, window_kind, window_start, used)
  VALUES (_bucket, 'minute', m_start, granted), (_bucket, 'day', d_start, granted)
  ON CONFLICT (bucket, window_kind, window_start)
  DO UPDATE SET used = public.global_api_usage.used + EXCLUDED.used;

  RETURN granted;
END
$$;

CREATE FUNCTION public.set_global_api_limit(_bucket text, _per_minute integer, _per_day integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _bucket IS NULL OR _bucket NOT IN ('text_search','nearby_search','details_full','details_basic','photo') THEN
    RAISE EXCEPTION 'bad_bucket';
  END IF;
  IF _per_minute IS NULL OR _per_day IS NULL OR _per_minute < 1 OR _per_day < 1 OR _per_minute > _per_day THEN
    RAISE EXCEPTION 'bad_limits';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('global_budget:' || _bucket, 0));
  INSERT INTO public.global_api_limits(bucket, per_minute, per_day, updated_at)
  VALUES (_bucket, _per_minute, _per_day, now())
  ON CONFLICT (bucket) DO UPDATE
    SET per_minute = EXCLUDED.per_minute, per_day = EXCLUDED.per_day, updated_at = now();
END
$$;

REVOKE ALL ON FUNCTION public.reserve_global_budget(text, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_global_api_limit(text, integer, integer)  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_global_budget(text, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_global_api_limit(text, integer, integer)  TO service_role;