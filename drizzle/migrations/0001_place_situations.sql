CREATE TABLE public.place_situations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id text NOT NULL REFERENCES public.places(google_place_id),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  situations text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  hidden boolean NOT NULL DEFAULT false
);
CREATE INDEX place_situations_place_idx ON public.place_situations(place_id, created_at DESC);
CREATE INDEX place_situations_user_idx ON public.place_situations(user_id, place_id, created_at DESC);
GRANT ALL ON public.place_situations TO service_role;
ALTER TABLE public.place_situations ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.place_situations IS 'Situação agora: written only by the postSituation server function after geofence check; read via place_situation_now(). Kept after expiry for history.';

CREATE TABLE public.situation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  situation_id uuid NOT NULL REFERENCES public.place_situations(id) ON DELETE CASCADE,
  reporter uuid NOT NULL,
  reason text NOT NULL DEFAULT 'inadequada',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (situation_id, reporter)
);
GRANT INSERT ON public.situation_reports TO authenticated;
GRANT ALL ON public.situation_reports TO service_role;
ALTER TABLE public.situation_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert own situation reports" ON public.situation_reports FOR INSERT TO authenticated WITH CHECK (reporter = auth.uid());

CREATE OR REPLACE FUNCTION public.place_situation_now(_place_ids text[])
RETURNS TABLE(place_id text, situation_id uuid, situations text[], updated_at timestamptz, expires_at timestamptz, people_here bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ids.pid, s.id, s.situations, s.created_at, s.expires_at,
    (SELECT count(*) FROM public.place_presence p WHERE p.place_id = ids.pid AND p.expires_at > now() AND p.mode IN ('meet','appear'))
  FROM unnest(_place_ids) AS ids(pid)
  LEFT JOIN LATERAL (
    SELECT * FROM public.place_situations x
    WHERE x.place_id = ids.pid AND x.expires_at > now() AND NOT x.hidden
    ORDER BY x.created_at DESC LIMIT 1
  ) s ON true
  WHERE auth.uid() IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.place_situation_now(text[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.place_situation_now(text[]) TO authenticated;