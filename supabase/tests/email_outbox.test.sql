-- Rolled back: ends with a raise exception so nothing persists.
do $$
declare n int; a int; claimed int;
begin
  insert into public.email_outbox (kind, to_email, subject, html, dedupe_key) values ('t','a@example.invalid','s','h','k1'), ('t','b@example.invalid','s','h','k2');
  insert into public.email_outbox (kind, to_email, subject, html, dedupe_key) values ('t','a@example.invalid','s','h','k1') on conflict (dedupe_key) do nothing;
  select count(*) into n from public.email_outbox where kind='t'; assert n = 2, 'dedupe failed';
  select count(*) into claimed from public.claim_email_batch(10) where kind='t'; assert claimed = 2, 'claim should return both';
  select count(*) into claimed from public.claim_email_batch(10) where kind='t'; assert claimed = 0, 'leased rows must not be claimed twice';
  select min(attempts) into a from public.email_outbox where kind='t'; assert a = 1, 'attempt not counted';
  update public.email_outbox set next_attempt_at = now() - interval '1 minute' where kind='t';
  select count(*) into claimed from public.claim_email_batch(10) where kind='t'; assert claimed = 2, 'expired lease should be re-claimable';
  raise exception 'ROLLBACK_OK all assertions passed';
end $$;
