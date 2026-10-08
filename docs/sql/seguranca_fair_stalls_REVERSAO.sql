-- NOT EXECUTED. Restores the audited table privileges; intentionally re-exposes created_by.
-- Valid only for audited initial grants: ALL for anon/authenticated, no column ACLs.
BEGIN;
REVOKE SELECT (id, place_id, name, kind, emoji, created_at) ON public.fair_stalls FROM authenticated;
GRANT ALL PRIVILEGES ON public.fair_stalls TO authenticated, anon;
COMMIT;
