CREATE OR REPLACE FUNCTION public.upsert_presence(_user uuid, _place_id text, _mode text, _interests text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _mode NOT IN ('meet','appear','invisible') THEN RAISE EXCEPTION 'bad_mode'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('presence:' || _user::text, 0));
  DELETE FROM public.place_presence WHERE user_id = _user;
  INSERT INTO public.place_presence(user_id, place_id, mode, visible, interests, status, started_at, expires_at)
  VALUES (_user, _place_id, _mode, _mode <> 'invisible', coalesce(_interests, '{}'), NULL, now(), now() + interval '3 hours');
END $$;
REVOKE ALL ON FUNCTION public.upsert_presence(uuid, text, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_presence(uuid, text, text, text[]) TO service_role;