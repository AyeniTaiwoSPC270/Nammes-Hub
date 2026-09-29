-- Server-side errors from the API routes that need a login, plus the webhooks.
-- Written by the API with the service role; only the owner can read it.
-- One row per distinct message per route per minute, so a repeating failure cannot flood the table.
create table public.error_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  route text not null,
  status int,
  message text not null,
  bucket bigint not null,
  unique (route, message, bucket)
);

alter table public.error_log enable row level security;
revoke all on public.error_log from anon, authenticated;
grant select on public.error_log to authenticated;
grant all on public.error_log to service_role;
create policy error_log_select_owner on public.error_log
  for select to authenticated using ((select public.is_owner()));
