CREATE TABLE public.places (
  google_place_id text PRIMARY KEY,
  name text NOT NULL,
  address text,
  category text,
  lat double precision,
  lng double precision,
  photo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.places TO authenticated;
GRANT ALL ON public.places TO service_role;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read places" ON public.places FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users add places" ON public.places FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users refresh places" ON public.places FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id text NOT NULL REFERENCES public.places(google_place_id),
  category text NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  would_return boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT false,
  visited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiences TO authenticated;
GRANT ALL ON public.experiences TO service_role;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or public experiences" ON public.experiences FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_public);
CREATE POLICY "Insert own experiences" ON public.experiences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own experiences" ON public.experiences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own experiences" ON public.experiences FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.experience_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id uuid NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  criterion text NOT NULL,
  score int NOT NULL CHECK (score BETWEEN 1 AND 5)
);
GRANT SELECT, INSERT, DELETE ON public.experience_scores TO authenticated;
GRANT ALL ON public.experience_scores TO service_role;
ALTER TABLE public.experience_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scores follow experience" ON public.experience_scores FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.experiences e WHERE e.id = experience_id AND (e.user_id = auth.uid() OR e.is_public)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.experiences e WHERE e.id = experience_id AND e.user_id = auth.uid()));

CREATE TABLE public.experience_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id uuid NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.experience_photos TO authenticated;
GRANT ALL ON public.experience_photos TO service_role;
ALTER TABLE public.experience_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read photos of visible experiences" ON public.experience_photos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.experiences e WHERE e.id = experience_id AND e.is_public));
CREATE POLICY "Insert own photos" ON public.experience_photos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own photos" ON public.experience_photos FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.saved_places (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id text NOT NULL REFERENCES public.places(google_place_id),
  list text NOT NULL CHECK (list IN ('quero_conhecer','ja_fui','favoritos')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id, list)
);
GRANT SELECT, INSERT, DELETE ON public.saved_places TO authenticated;
GRANT ALL ON public.saved_places TO service_role;
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own saved places" ON public.saved_places FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users upload own experience photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'experience-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users read own experience photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'experience-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own experience photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'experience-photos' AND (storage.foldername(name))[1] = auth.uid()::text);