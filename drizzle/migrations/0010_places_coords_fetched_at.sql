ALTER TABLE public.places ADD COLUMN IF NOT EXISTS coords_fetched_at timestamptz DEFAULT now();
UPDATE public.places SET coords_fetched_at = now() WHERE coords_fetched_at IS NULL;
COMMENT ON COLUMN public.places.coords_fetched_at IS 'When lat/lng were last fetched from Google; coordinates are cleared after 25 days (Google Places caching limit is 30 days).';
CREATE INDEX IF NOT EXISTS places_coords_fetched_at_idx ON public.places (coords_fetched_at) WHERE lat IS NOT NULL;
CREATE EXTENSION IF NOT EXISTS pg_cron;