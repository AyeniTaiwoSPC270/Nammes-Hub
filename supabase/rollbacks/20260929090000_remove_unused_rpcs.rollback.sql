-- Restores execute on admin_set_user_disabled. is_student_id_taken must be recreated from its original definition
-- in the earlier migrations if it is ever needed again.
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;
