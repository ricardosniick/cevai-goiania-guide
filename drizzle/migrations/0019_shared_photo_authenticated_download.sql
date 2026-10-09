-- REVIEW ONLY: apply only after publishing and validating the authenticated-download UI.
-- No data, bucket visibility, existing policies, or upload/delete permissions are changed.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'experience-photos' AND public = false) THEN
    RAISE EXCEPTION 'Expected a private experience-photos bucket';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'storage' AND c.relname = 'objects' AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'Expected storage.objects RLS';
  END IF;
  IF to_regprocedure('storage.allow_only_operation(text)') IS NULL OR
     to_regprocedure('storage.operation()') IS NULL THEN
    RAISE EXCEPTION 'Storage operation helpers are missing';
  END IF;
  IF NOT has_function_privilege('authenticated', 'storage.allow_only_operation(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated users cannot execute the operation helper';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'storage.objects'::regclass
                 AND polname = 'Read photos of shared experiences' AND polcmd = 'r' AND polpermissive) THEN
    RAISE EXCEPTION 'Expected the previously audited shared-photo read policy';
  END IF;
END;
$$;

-- Restrictive = AND with all applicable permissive policies, not an additional grant.
-- Non-owners must use authenticated download. Signing, bulk signing, listing, copying,
-- image transforms, S3 and unset/unknown operations cannot bypass this guard.
-- The existing permissive policy still verifies public experience + owner + folder.
CREATE POLICY "Shared photos require authenticated download"
ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (
  bucket_id <> 'experience-photos'
  OR split_part(name, '/', 1) = auth.uid()::text
  OR (auth.uid() IS NOT NULL AND storage.allow_only_operation('storage.object.get_authenticated'))
);
COMMIT;
