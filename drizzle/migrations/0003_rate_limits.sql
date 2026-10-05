CREATE TABLE public.rate_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rate_events TO service_role;
ALTER TABLE public.rate_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX rate_events_lookup ON public.rate_events (user_id, bucket, created_at DESC);

-- Atomic check-and-record: an advisory lock per user+bucket serializes concurrent calls.
CREATE OR REPLACE FUNCTION public.hit_rate_limit(_user uuid, _bucket text, _max int, _window_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_user::text || ':' || _bucket, 0));
  DELETE FROM public.rate_events WHERE user_id = _user AND bucket = _bucket AND created_at < now() - interval '1 day';
  SELECT count(*) INTO n FROM public.rate_events
    WHERE user_id = _user AND bucket = _bucket AND created_at > now() - make_interval(secs => _window_seconds);
  IF n >= _max THEN RETURN false; END IF;
  INSERT INTO public.rate_events(user_id, bucket) VALUES (_user, _bucket);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.hit_rate_limit(uuid, text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(uuid, text, int, int) TO service_role;