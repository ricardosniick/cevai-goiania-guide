ALTER TABLE public.places ADD COLUMN IF NOT EXISTS photo_name text;
COMMENT ON COLUMN public.places.photo_name IS 'Google photo resource name (places/.../photos/...); the URL is generated on display.';
COMMENT ON COLUMN public.places.photo_url IS 'DEPRECATED: temporary Google URL, no longer written; kept as fallback for older rows. Use photo_name.';