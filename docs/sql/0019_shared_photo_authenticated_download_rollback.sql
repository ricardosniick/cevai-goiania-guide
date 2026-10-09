-- REVIEW ONLY. Restores the original shared-photo signing capability.
-- This is a privacy rollback: third parties can generate transferable signed URLs again.
-- It does not revoke URLs already issued or delete any file.
BEGIN;
DROP POLICY "Shared photos require authenticated download" ON storage.objects;
COMMIT;
