-- NOT EXECUTED. First restore/merge/publish app code that does not call create_experience.
-- Removing this function while the current code uses it blocks new experience creation.
-- Does not remove experiences, scores or photos.
BEGIN;
DROP FUNCTION public.create_experience(text, text, integer, text, boolean, uuid, jsonb);
COMMIT;
