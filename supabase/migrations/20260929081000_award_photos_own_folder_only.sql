-- Follow-up: now that the client uploads nominee photos to <user-id>/..., remove the old policy
-- that let any signed-in user write anywhere in the bucket. Admins keep their own insert policy.
-- Apply ONLY after the client change is deployed.

drop policy if exists award_nominee_photos_insert_authenticated on storage.objects;
