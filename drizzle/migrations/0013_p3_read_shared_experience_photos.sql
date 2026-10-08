BEGIN;
CREATE POLICY "Read photos of shared experiences"
ON storage.objects FOR SELECT TO authenticated
USING (
  storage.objects.bucket_id = 'experience-photos'
  AND EXISTS (
    SELECT 1
    FROM public.experience_photos p
    JOIN public.experiences e ON e.id = p.experience_id
    WHERE p.storage_path = storage.objects.name
      AND e.is_public = true
      AND p.user_id = e.user_id
      AND split_part(storage.objects.name, '/', 1) = p.user_id::text
  )
);
COMMIT;