BEGIN;
REVOKE EXECUTE ON FUNCTION public.place_experience_stats(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.stall_experience_stats(uuid[]) FROM PUBLIC, anon;
COMMIT;