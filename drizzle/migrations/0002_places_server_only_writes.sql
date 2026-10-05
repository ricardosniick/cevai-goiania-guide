-- Places are written only by server functions with Google-verified data.
DROP POLICY IF EXISTS "Signed-in users add places" ON public.places;
DROP POLICY IF EXISTS "Signed-in users refresh places" ON public.places;
REVOKE INSERT, UPDATE, DELETE ON public.places FROM authenticated, anon;
GRANT SELECT ON public.places TO authenticated;
GRANT ALL ON public.places TO service_role;