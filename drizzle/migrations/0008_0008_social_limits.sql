CREATE OR REPLACE FUNCTION public.send_chat_message(_request_id uuid, _body text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.connection_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM public.cleanup_presence();
  IF length(trim(_body)) = 0 OR length(_body) > 1000 THEN RAISE EXCEPTION 'bad_body'; END IF;
  SELECT * INTO r FROM public.connection_requests c WHERE c.id = _request_id AND c.status = 'accepted' AND (c.from_user = auth.uid() OR c.to_user = auth.uid());
  IF r.id IS NULL THEN RAISE EXCEPTION 'closed'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_blocks b WHERE (b.blocker = r.from_user AND b.blocked = r.to_user) OR (b.blocker = r.to_user AND b.blocked = r.from_user)) THEN RAISE EXCEPTION 'closed'; END IF;
  IF NOT public.hit_rate_limit(auth.uid(), 'chat', 20, 60) THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO public.chat_messages(request_id, sender, body) VALUES (_request_id, auth.uid(), trim(_body));
END $function$;

CREATE OR REPLACE FUNCTION public.send_connection(_to uuid, _place_id text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me public.place_presence; them public.place_presence;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM public.cleanup_presence();
  SELECT * INTO me FROM public.place_presence WHERE user_id = auth.uid() AND place_id = _place_id;
  SELECT * INTO them FROM public.place_presence WHERE user_id = _to AND place_id = _place_id;
  IF me.user_id IS NULL OR them.user_id IS NULL OR _to = auth.uid() THEN RAISE EXCEPTION 'not_present'; END IF;
  IF me.mode <> 'meet' OR them.mode <> 'meet' THEN RAISE EXCEPTION 'not_open'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_blocks b WHERE (b.blocker = auth.uid() AND b.blocked = _to) OR (b.blocker = _to AND b.blocked = auth.uid())) THEN RAISE EXCEPTION 'blocked'; END IF;
  IF EXISTS (SELECT 1 FROM public.connection_requests c WHERE c.place_id = _place_id AND ((c.from_user = auth.uid() AND c.to_user = _to) OR (c.from_user = _to AND c.to_user = auth.uid()))) THEN RAISE EXCEPTION 'already'; END IF;
  IF NOT public.hit_rate_limit(auth.uid(), 'connection', 10, 3600) THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO public.connection_requests(place_id, from_user, to_user, from_presence_started) VALUES (_place_id, auth.uid(), _to, me.started_at);
END $function$;

-- user_reports: reporter is always the caller; repeated report (same target, same place) is skipped silently; 10/hour.
CREATE OR REPLACE FUNCTION public.user_reports_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NEW.reporter IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('report:' || NEW.reporter::text, 0));
  IF EXISTS (SELECT 1 FROM public.user_reports r WHERE r.reporter = NEW.reporter AND r.reported = NEW.reported AND r.place_id IS NOT DISTINCT FROM NEW.place_id) THEN
    RETURN NULL;
  END IF;
  IF NOT public.hit_rate_limit(NEW.reporter, 'user_report', 10, 3600) THEN RAISE EXCEPTION 'rate_limited'; END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS user_reports_guard ON public.user_reports;
CREATE TRIGGER user_reports_guard BEFORE INSERT ON public.user_reports FOR EACH ROW EXECUTE FUNCTION public.user_reports_guard();

-- situation_reports: auto-hide after 3 distinct reporters (author excluded). Nothing is deleted.
CREATE OR REPLACE FUNCTION public.situation_reports_autohide()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n int; s public.place_situations;
BEGIN
  SELECT * INTO s FROM public.place_situations WHERE id = NEW.situation_id FOR UPDATE;
  IF s.id IS NULL OR s.hidden THEN RETURN NULL; END IF;
  SELECT count(DISTINCT r.reporter) INTO n FROM public.situation_reports r WHERE r.situation_id = s.id AND r.reporter <> s.user_id;
  IF n >= 3 THEN
    UPDATE public.place_situations SET hidden = true WHERE id = s.id;
    RAISE LOG 'situation % auto-hidden after % distinct reports', s.id, n;
  END IF;
  RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS situation_reports_autohide ON public.situation_reports;
CREATE TRIGGER situation_reports_autohide AFTER INSERT ON public.situation_reports FOR EACH ROW EXECUTE FUNCTION public.situation_reports_autohide();

REVOKE ALL ON FUNCTION public.send_chat_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.send_connection(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_connection(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.user_reports_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.situation_reports_autohide() FROM PUBLIC, anon, authenticated;