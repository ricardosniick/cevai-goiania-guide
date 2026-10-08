-- NOT EXECUTED. First restore the app version that calls create_experience.
-- Does not remove records or change the previous function.
BEGIN;
DROP FUNCTION public.create_experience_once(uuid, text, text, integer, text, boolean, uuid, jsonb);
COMMIT;
