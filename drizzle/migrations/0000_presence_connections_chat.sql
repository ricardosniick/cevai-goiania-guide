ALTER TABLE public.place_presence ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'invisible';
ALTER TABLE public.place_presence ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';
REVOKE INSERT, UPDATE ON public.place_presence FROM authenticated;
GRANT SELECT, DELETE ON public.place_presence TO authenticated;
GRANT ALL ON public.place_presence TO service_role;

CREATE TABLE public.connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id text NOT NULL,
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  from_presence_started timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, from_user, to_user, from_presence_started)
);
GRANT ALL ON public.connection_requests TO service_role;
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.connection_requests(id) ON DELETE CASCADE,
  sender uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_blocks (
  blocker uuid NOT NULL,
  blocked uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker, blocked)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own blocks" ON public.user_blocks FOR ALL TO authenticated USING (blocker = auth.uid()) WITH CHECK (blocker = auth.uid());

CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter uuid NOT NULL,
  reported uuid NOT NULL,
  place_id text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert own reports" ON public.user_reports FOR INSERT TO authenticated WITH CHECK (reporter = auth.uid());

CREATE OR REPLACE FUNCTION public.cleanup_presence() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.place_presence WHERE expires_at <= now();
  DELETE FROM public.connection_requests c WHERE
    NOT EXISTS (SELECT 1 FROM public.place_presence p WHERE p.user_id = c.from_user AND p.place_id = c.place_id AND p.started_at = c.from_presence_started)
    OR NOT EXISTS (SELECT 1 FROM public.place_presence p WHERE p.user_id = c.to_user AND p.place_id = c.place_id);
$$;

CREATE OR REPLACE FUNCTION public.end_presence() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.place_presence WHERE user_id = auth.uid();
  PERFORM public.cleanup_presence();
END $$;

CREATE OR REPLACE FUNCTION public.place_people_v2(_place_id text)
RETURNS TABLE(user_id uuid, first_name text, mode text, interests text[], is_me boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.cleanup_presence();
  IF NOT EXISTS (SELECT 1 FROM public.place_presence pp WHERE pp.user_id = auth.uid() AND pp.place_id = _place_id) THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.user_id, coalesce(nullif(split_part(pr.full_name, ' ', 1), ''), 'Alguém'), p.mode,
         CASE WHEN p.mode = 'meet' THEN p.interests ELSE '{}'::text[] END, p.user_id = auth.uid()
  FROM public.place_presence p LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.place_id = _place_id AND (p.mode IN ('meet','appear') OR p.user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.user_blocks b WHERE (b.blocker = auth.uid() AND b.blocked = p.user_id) OR (b.blocker = p.user_id AND b.blocked = auth.uid()))
  ORDER BY p.started_at DESC LIMIT 50;
END $$;

CREATE OR REPLACE FUNCTION public.send_connection(_to uuid, _place_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me public.place_presence; them public.place_presence;
BEGIN
  PERFORM public.cleanup_presence();
  SELECT * INTO me FROM public.place_presence WHERE user_id = auth.uid() AND place_id = _place_id;
  SELECT * INTO them FROM public.place_presence WHERE user_id = _to AND place_id = _place_id;
  IF me.user_id IS NULL OR them.user_id IS NULL OR _to = auth.uid() THEN RAISE EXCEPTION 'not_present'; END IF;
  IF me.mode <> 'meet' OR them.mode <> 'meet' THEN RAISE EXCEPTION 'not_open'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_blocks b WHERE (b.blocker = auth.uid() AND b.blocked = _to) OR (b.blocker = _to AND b.blocked = auth.uid())) THEN RAISE EXCEPTION 'blocked'; END IF;
  IF EXISTS (SELECT 1 FROM public.connection_requests c WHERE c.place_id = _place_id AND ((c.from_user = auth.uid() AND c.to_user = _to) OR (c.from_user = _to AND c.to_user = auth.uid()))) THEN RAISE EXCEPTION 'already'; END IF;
  INSERT INTO public.connection_requests(place_id, from_user, to_user, from_presence_started) VALUES (_place_id, auth.uid(), _to, me.started_at);
END $$;

CREATE OR REPLACE FUNCTION public.respond_connection(_id uuid, _action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.connection_requests;
BEGIN
  PERFORM public.cleanup_presence();
  SELECT * INTO r FROM public.connection_requests WHERE id = _id AND to_user = auth.uid() AND status = 'pending';
  IF r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _action = 'accept' THEN UPDATE public.connection_requests SET status = 'accepted' WHERE id = _id;
  ELSIF _action = 'decline' THEN UPDATE public.connection_requests SET status = 'declined' WHERE id = _id;
  ELSIF _action = 'block' THEN
    INSERT INTO public.user_blocks(blocker, blocked) VALUES (auth.uid(), r.from_user) ON CONFLICT DO NOTHING;
    UPDATE public.connection_requests SET status = 'blocked' WHERE id = _id;
  ELSE RAISE EXCEPTION 'bad_action'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.my_connections(_place_id text)
RETURNS TABLE(id uuid, other_id uuid, other_name text, status text, incoming boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.cleanup_presence();
  RETURN QUERY
  SELECT c.id, CASE WHEN c.from_user = auth.uid() THEN c.to_user ELSE c.from_user END,
         coalesce(nullif(split_part(pr.full_name, ' ', 1), ''), 'Alguém'),
         CASE WHEN c.from_user = auth.uid() AND c.status IN ('declined','blocked') THEN 'pending' ELSE c.status END,
         c.to_user = auth.uid()
  FROM public.connection_requests c
  LEFT JOIN public.profiles pr ON pr.user_id = CASE WHEN c.from_user = auth.uid() THEN c.to_user ELSE c.from_user END
  WHERE c.place_id = _place_id AND (c.from_user = auth.uid() OR c.to_user = auth.uid())
  ORDER BY c.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.chat_messages_for(_request_id uuid)
RETURNS TABLE(id uuid, mine boolean, body text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.cleanup_presence();
  IF NOT EXISTS (SELECT 1 FROM public.connection_requests c WHERE c.id = _request_id AND c.status = 'accepted' AND (c.from_user = auth.uid() OR c.to_user = auth.uid())) THEN RETURN; END IF;
  RETURN QUERY SELECT m.id, m.sender = auth.uid(), m.body, m.created_at FROM public.chat_messages m WHERE m.request_id = _request_id ORDER BY m.created_at LIMIT 300;
END $$;

CREATE OR REPLACE FUNCTION public.send_chat_message(_request_id uuid, _body text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.cleanup_presence();
  IF length(trim(_body)) = 0 OR length(_body) > 1000 THEN RAISE EXCEPTION 'bad_body'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.connection_requests c WHERE c.id = _request_id AND c.status = 'accepted' AND (c.from_user = auth.uid() OR c.to_user = auth.uid())) THEN RAISE EXCEPTION 'closed'; END IF;
  INSERT INTO public.chat_messages(request_id, sender, body) VALUES (_request_id, auth.uid(), trim(_body));
END $$;

REVOKE EXECUTE ON FUNCTION public.cleanup_presence() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.end_presence(), public.place_people_v2(text), public.send_connection(uuid, text), public.respond_connection(uuid, text), public.my_connections(text), public.chat_messages_for(uuid), public.send_chat_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_presence(), public.place_people_v2(text), public.send_connection(uuid, text), public.respond_connection(uuid, text), public.my_connections(text), public.chat_messages_for(uuid), public.send_chat_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_presence() TO service_role, authenticated;
COMMENT ON FUNCTION public.place_people(text) IS 'DEPRECATED: replaced by place_people_v2';