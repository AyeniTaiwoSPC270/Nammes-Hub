-- Lets the owner delete contact messages from the admin Messages page (no delete policy existed).
create policy contact_messages_delete_owner on public.contact_messages
  for delete to authenticated using ((select public.is_owner()));
grant delete on public.contact_messages to authenticated;
