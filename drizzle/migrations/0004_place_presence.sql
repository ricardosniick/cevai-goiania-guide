CREATE TABLE public.place_presence (
  user_id uuid PRIMARY KEY,
  place_id text NOT NULL REFERENCES public.places(google_place_id),
  visible boolean NOT NULL DEFAULT false,
  status text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 hours')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_presence TO authenticated;
GRANT ALL ON public.place_presence TO service_role;
ALTER TABLE public.place_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own presence" ON public.place_presence FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.place_people(_place_id text)
RETURNS TABLE(first_name text, status text, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(split_part(pr.full_name, ' ', 1), ''), 'Alguém'), p.status, p.user_id = auth.uid()
  FROM public.place_presence p LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE auth.uid() IS NOT NULL AND p.place_id = _place_id AND p.visible AND p.expires_at > now()
  ORDER BY p.started_at DESC LIMIT 50
$$;
REVOKE EXECUTE ON FUNCTION public.place_people(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.place_people(text) TO authenticated;