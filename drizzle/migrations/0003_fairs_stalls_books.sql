CREATE TABLE public.fair_stalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id text NOT NULL REFERENCES public.places(google_place_id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  kind text NOT NULL DEFAULT 'Comida' CHECK (char_length(kind) <= 30),
  emoji text NOT NULL DEFAULT '🛖' CHECK (char_length(emoji) <= 8),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fair_stalls TO authenticated;
GRANT ALL ON public.fair_stalls TO service_role;
ALTER TABLE public.fair_stalls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view stalls" ON public.fair_stalls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create stalls" ON public.fair_stalls FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creators update stalls" ON public.fair_stalls FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Creators delete stalls" ON public.fair_stalls FOR DELETE TO authenticated USING (created_by = auth.uid());
CREATE INDEX fair_stalls_place_idx ON public.fair_stalls(place_id);

ALTER TABLE public.experiences ADD COLUMN stall_id uuid REFERENCES public.fair_stalls(id) ON DELETE CASCADE;
CREATE INDEX experiences_stall_idx ON public.experiences(stall_id);

CREATE OR REPLACE FUNCTION public.place_experience_stats(_place_ids text[])
RETURNS TABLE(place_id text, avg_rating numeric, experience_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.place_id, round(avg(e.rating)::numeric, 1), count(*)
  FROM public.experiences e
  WHERE e.place_id = ANY(_place_ids) AND e.stall_id IS NULL
  GROUP BY e.place_id
$$;

CREATE OR REPLACE FUNCTION public.stall_experience_stats(_stall_ids uuid[])
RETURNS TABLE(stall_id uuid, avg_rating numeric, experience_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.stall_id, round(avg(e.rating)::numeric, 1), count(*)
  FROM public.experiences e
  WHERE e.stall_id = ANY(_stall_ids)
  GROUP BY e.stall_id
$$;
REVOKE ALL ON FUNCTION public.stall_experience_stats(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.stall_experience_stats(uuid[]) TO authenticated;

CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  author text CHECK (char_length(author) <= 120),
  status text NOT NULL DEFAULT 'quero_ler' CHECK (status IN ('quero_ler','lendo','terminei')),
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 1000),
  would_recommend boolean,
  photo_path text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own books select" ON public.books FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own books insert" ON public.books FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own books update" ON public.books FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own books delete" ON public.books FOR DELETE TO authenticated USING (user_id = auth.uid());