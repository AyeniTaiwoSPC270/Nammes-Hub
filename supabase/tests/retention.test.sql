-- Rolled back: ends with a raise exception so nothing persists.
do $$
declare u uuid := gen_random_uuid(); n int;
begin
  insert into auth.users (id, email, instance_id, aud, role) values (u, 'retention-test@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.profiles (user_id, student_id, full_name) values (u, '990406999', 'Test Person');
  insert into public.contact_messages (name, email, message, created_at) values ('Old', 'old@example.invalid', 'x', now() - interval '13 months'), ('New', 'new@example.invalid', 'y', now());
  insert into public.error_log (route, message, bucket, at) values ('t', 'old', 1, now() - interval '31 days'), ('t', 'new', 2, now());
  perform public.purge_old_data();
  select count(*) into n from public.contact_messages where email = 'old@example.invalid'; assert n = 0, 'old message kept';
  select count(*) into n from public.contact_messages where email = 'new@example.invalid'; assert n = 1, 'new message lost';
  select count(*) into n from public.error_log where message = 'old'; assert n = 0, 'old error kept';
  select count(*) into n from public.error_log where message = 'new'; assert n = 1, 'new error lost';
  perform public.anonymise_user(u);
  select count(*) into n from public.profiles where user_id = u; assert n = 0, 'profile kept';
  raise exception 'ROLLBACK_OK all assertions passed';
end $$;
