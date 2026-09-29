drop policy if exists contact_messages_delete_owner on public.contact_messages;
revoke delete on public.contact_messages from authenticated;
