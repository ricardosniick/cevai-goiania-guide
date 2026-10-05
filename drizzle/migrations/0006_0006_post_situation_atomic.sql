CREATE INDEX IF NOT EXISTS place_situations_user_created_idx ON public.place_situations (user_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.post_situation(_user uuid, _place_id text, _kind text, _situations text[])
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('situation:' || _user::text, 0));
  IF EXISTS (SELECT 1 FROM public.place_situations WHERE user_id = _user AND place_id = _place_id AND created_at > now() - interval '10 minutes') THEN
    RETURN 'recent';
  END IF;
  IF (SELECT count(*) FROM public.place_situations WHERE user_id = _user AND created_at > now() - interval '1 hour') >= 10 THEN
    RETURN 'hourly';
  END IF;
  INSERT INTO public.place_situations(place_id, user_id, kind, situations, created_at, expires_at)
  VALUES (_place_id, _user, _kind, _situations, now(), now() + interval '2 hours');
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.post_situation(uuid, text, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_situation(uuid, text, text, text[]) TO service_role;