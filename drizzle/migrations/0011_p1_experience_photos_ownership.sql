DROP POLICY "Insert own photos" ON public.experience_photos;
CREATE POLICY "Insert own photos" ON public.experience_photos
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    experience_photos.user_id = auth.uid()
    AND split_part(experience_photos.storage_path, '/', 1) = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.experiences e
                WHERE e.id = experience_photos.experience_id
                  AND e.user_id = auth.uid())
  );
CREATE POLICY "Photo insert ownership guard" ON public.experience_photos
  AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK (
    experience_photos.user_id = auth.uid()
    AND split_part(experience_photos.storage_path, '/', 1) = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.experiences e
                WHERE e.id = experience_photos.experience_id
                  AND e.user_id = auth.uid())
  );
CREATE POLICY "Photo update ownership guard" ON public.experience_photos
  AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING (
    experience_photos.user_id = auth.uid()
    AND split_part(experience_photos.storage_path, '/', 1) = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.experiences e
                WHERE e.id = experience_photos.experience_id
                  AND e.user_id = auth.uid())
  )
  WITH CHECK (
    experience_photos.user_id = auth.uid()
    AND split_part(experience_photos.storage_path, '/', 1) = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.experiences e
                WHERE e.id = experience_photos.experience_id
                  AND e.user_id = auth.uid())
  );