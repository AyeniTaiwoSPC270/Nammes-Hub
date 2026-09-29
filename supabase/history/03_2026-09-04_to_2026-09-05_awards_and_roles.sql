-- Exported from Supabase's applied-migration history. Apply after 02_*.sql. See 01 for notes.
-- The owner's email address in the seed step below is replaced with a placeholder: set it yourself.

-- ===== 20260904143453_award_voting_schema =====
create table award_seasons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  phase text not null default 'nominating'
    check (phase in ('nominating', 'curating', 'voting', 'closed', 'revealed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table award_categories (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references award_seasons(id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0
);

create table award_nominations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references award_categories(id) on delete cascade,
  submitted_by uuid not null references auth.users(id),
  nominee_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table award_nominees (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references award_categories(id) on delete cascade,
  name text not null,
  photo_url text,
  sort_order int not null default 0
);

create table award_votes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references award_categories(id) on delete cascade,
  nominee_id uuid not null references award_nominees(id) on delete cascade,
  voter_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table award_seasons enable row level security;
alter table award_categories enable row level security;
alter table award_nominees enable row level security;
alter table award_nominations enable row level security;
alter table award_votes enable row level security;

create policy award_seasons_select_all on award_seasons for select using (true);
create policy award_seasons_insert_admin on award_seasons for insert with check (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_seasons_update_admin on award_seasons for update using (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_seasons_delete_admin on award_seasons for delete using (exists (select 1 from admins where admins.user_id = auth.uid()));

create policy award_categories_select_all on award_categories for select using (true);
create policy award_categories_insert_admin on award_categories for insert with check (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_categories_update_admin on award_categories for update using (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_categories_delete_admin on award_categories for delete using (exists (select 1 from admins where admins.user_id = auth.uid()));

create policy award_nominees_select_all on award_nominees for select using (true);
create policy award_nominees_insert_admin on award_nominees for insert with check (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_nominees_update_admin on award_nominees for update using (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_nominees_delete_admin on award_nominees for delete using (exists (select 1 from admins where admins.user_id = auth.uid()));

create policy award_nominations_insert on award_nominations for insert with check (
  auth.uid() = submitted_by
  and exists (select 1 from profiles where profiles.user_id = auth.uid())
  and exists (
    select 1 from award_categories c join award_seasons s on s.id = c.season_id
    where c.id = award_nominations.category_id and s.phase = 'nominating'
  )
);
create policy award_nominations_update_own on award_nominations for update using (
  auth.uid() = submitted_by
) with check (
  auth.uid() = submitted_by
  and exists (
    select 1 from award_categories c join award_seasons s on s.id = c.season_id
    where c.id = award_nominations.category_id and s.phase = 'nominating'
  )
);
create policy award_nominations_select on award_nominations for select using (
  auth.uid() = submitted_by or exists (select 1 from admins where admins.user_id = auth.uid())
);
create policy award_nominations_delete_admin on award_nominations for delete using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);

create policy award_votes_insert on award_votes for insert with check (
  auth.uid() = voter_id
  and exists (select 1 from profiles where profiles.user_id = auth.uid())
  and exists (
    select 1 from award_categories c join award_seasons s on s.id = c.season_id
    where c.id = award_votes.category_id and s.phase = 'voting'
  )
);
create policy award_votes_select on award_votes for select using (
  auth.uid() = voter_id
  or exists (select 1 from admins where admins.user_id = auth.uid())
  or exists (
    select 1 from award_categories c join award_seasons s on s.id = c.season_id
    where c.id = award_votes.category_id and s.phase = 'revealed'
  )
);
create policy award_votes_delete_admin on award_votes for delete using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);

-- ===== 20260904143541_award_voting_dedup_triggers =====
create or replace function enforce_one_nomination_per_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from award_nominations
    where category_id = new.category_id and submitted_by = new.submitted_by
  ) then
    raise exception 'You have already nominated someone for this category.';
  end if;
  return new;
end;
$$;

create trigger award_nominations_dedup
before insert on award_nominations
for each row execute function enforce_one_nomination_per_person();

create or replace function enforce_one_vote_per_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from award_votes
    where category_id = new.category_id and voter_id = new.voter_id
  ) then
    raise exception 'You have already voted in this category.';
  end if;
  return new;
end;
$$;

create trigger award_votes_dedup
before insert on award_votes
for each row execute function enforce_one_vote_per_person();

-- ===== 20260904143645_award_voting_ballot_rpc =====
create or replace function submit_award_ballot(p_votes jsonb)
returns void
language plpgsql
as $$
declare
  v jsonb;
begin
  for v in select * from jsonb_array_elements(p_votes)
  loop
    insert into award_votes (category_id, nominee_id, voter_id)
    values (
      (v->>'category_id')::uuid,
      (v->>'nominee_id')::uuid,
      auth.uid()
    );
  end loop;
end;
$$;

grant execute on function submit_award_ballot(jsonb) to authenticated;

-- ===== 20260904143731_award_voting_ballot_rpc_tighten_grants =====
revoke execute on function submit_award_ballot(jsonb) from public, anon;

-- ===== 20260904143741_award_nominee_photos_bucket =====
insert into storage.buckets (id, name, public) values ('award-nominee-photos', 'award-nominee-photos', true);

create policy award_nominee_photos_public_select on storage.objects for select using (bucket_id = 'award-nominee-photos');
create policy award_nominee_photos_admin_insert on storage.objects for insert with check (
  bucket_id = 'award-nominee-photos' and auth.uid() in (select admins.user_id from admins)
);
create policy award_nominee_photos_admin_update on storage.objects for update using (
  bucket_id = 'award-nominee-photos' and auth.uid() in (select admins.user_id from admins)
);
create policy award_nominee_photos_admin_delete on storage.objects for delete using (
  bucket_id = 'award-nominee-photos' and auth.uid() in (select admins.user_id from admins)
);

-- ===== 20260905084458_admin_users_roles_and_review_queue =====
-- activity + soft disable
alter table public.profiles
  add column last_seen_at timestamptz,
  add column is_disabled boolean not null default false;

-- ownership
alter table public.admins
  add column is_owner boolean not null default false;

create unique index admins_one_owner_idx on public.admins (is_owner) where is_owner;

create policy admins_select_admin_all on public.admins
  for select
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy admins_insert_admin on public.admins
  for insert
  with check (
    is_owner = false
    or exists (select 1 from public.admins a where a.user_id = auth.uid() and a.is_owner)
  );

create policy admins_delete_admin on public.admins
  for delete
  using (exists (select 1 from public.admins a where a.user_id = auth.uid() and a.is_owner));

create or replace function public.admins_guard_delete() returns trigger
language plpgsql security definer as $$
begin
  if old.is_owner then
    raise exception 'Cannot remove the owner directly. Transfer ownership first.';
  end if;
  if (select count(*) from public.admins) <= 1 then
    raise exception 'Cannot remove the last remaining admin.';
  end if;
  return old;
end;
$$;

create trigger admins_before_delete
  before delete on public.admins
  for each row execute function public.admins_guard_delete();

create policy profiles_select_admin on public.profiles
  for select
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create or replace function public.touch_last_seen() returns void
language plpgsql security definer as $$
begin
  update public.profiles set last_seen_at = now() where user_id = auth.uid();
end;
$$;

create or replace function public.admin_set_user_disabled(target uuid, disabled boolean) returns void
language plpgsql security definer as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Only admins can do this.';
  end if;
  if exists (select 1 from public.admins where user_id = target and is_owner) then
    raise exception 'The owner cannot be disabled.';
  end if;
  update public.profiles set is_disabled = disabled where user_id = target;
end;
$$;

create or replace function public.transfer_ownership(new_owner uuid) returns void
language plpgsql security definer as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid() and is_owner) then
    raise exception 'Only the current owner can transfer ownership.';
  end if;
  if not exists (select 1 from public.admins where user_id = new_owner) then
    raise exception 'Target user must already be an admin.';
  end if;
  update public.admins set is_owner = false where user_id = auth.uid();
  update public.admins set is_owner = true where user_id = new_owner;
end;
$$;

-- review queue
create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('news', 'events', 'award_season')),
  action text not null check (action in ('insert', 'update')),
  record_id text,
  payload jsonb not null,
  submitted_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

alter table public.change_requests enable row level security;

create policy change_requests_select_own on public.change_requests
  for select using (auth.uid() = submitted_by);

create policy change_requests_select_owner on public.change_requests
  for select using (exists (select 1 from public.admins a where a.user_id = auth.uid() and a.is_owner));

create or replace function public.submit_change_request(p_entity_type text, p_action text, p_record_id text, p_payload jsonb)
returns uuid
language plpgsql security definer as $$
declare
  new_id uuid;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Only admins can submit changes.';
  end if;
  insert into public.change_requests (entity_type, action, record_id, payload, submitted_by)
  values (p_entity_type, p_action, p_record_id, p_payload, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.reject_change_request(p_id uuid, p_reason text)
returns void
language plpgsql security definer as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid() and is_owner) then
    raise exception 'Only the owner can review changes.';
  end if;
  update public.change_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_reason
    where id = p_id and status = 'pending';
end;
$$;

create or replace function public.apply_change_request(p_id uuid)
returns void
language plpgsql security definer as $$
declare
  req public.change_requests%rowtype;
  target_season_id uuid;
  cat jsonb;
  existing_ids uuid[];
  keep_ids uuid[];
begin
  if not exists (select 1 from public.admins where user_id = auth.uid() and is_owner) then
    raise exception 'Only the owner can review changes.';
  end if;

  select * into req from public.change_requests where id = p_id and status = 'pending';
  if not found then
    raise exception 'No pending request with that id.';
  end if;

  if req.entity_type = 'news' then
    if req.action = 'insert' then
      insert into public.news (id, category, tone, date, title, body, author, badge_tone, badge_label, image_url, image_width_pct)
      values (
        req.payload->>'id', req.payload->>'category', req.payload->>'tone', (req.payload->>'date')::date,
        req.payload->>'title', req.payload->>'body', req.payload->>'author',
        req.payload->>'badge_tone', req.payload->>'badge_label', req.payload->>'image_url',
        (req.payload->>'image_width_pct')::int
      );
    else
      update public.news set
        category = req.payload->>'category', tone = req.payload->>'tone', date = (req.payload->>'date')::date,
        title = req.payload->>'title', body = req.payload->>'body', author = req.payload->>'author',
        badge_tone = req.payload->>'badge_tone', badge_label = req.payload->>'badge_label',
        image_url = req.payload->>'image_url', image_width_pct = (req.payload->>'image_width_pct')::int
      where id = req.record_id;
    end if;

  elsif req.entity_type = 'events' then
    if req.action = 'insert' then
      insert into public.events (id, title, date, tone, meta, description, image_url)
      values (
        req.payload->>'id', req.payload->>'title', req.payload->>'date', req.payload->>'tone',
        req.payload->>'meta', req.payload->>'description', req.payload->>'image_url'
      );
    else
      update public.events set
        title = req.payload->>'title', date = req.payload->>'date', tone = req.payload->>'tone',
        meta = req.payload->>'meta', description = req.payload->>'description', image_url = req.payload->>'image_url'
      where id = req.record_id;
    end if;

  elsif req.entity_type = 'award_season' then
    if req.action = 'insert' then
      insert into public.award_seasons (title, phase, created_by)
      values (req.payload->>'title', 'nominating', req.submitted_by)
      returning id into target_season_id;
    else
      target_season_id := req.record_id::uuid;
      update public.award_seasons set title = req.payload->>'title' where id = target_season_id;
    end if;

    select coalesce(array_agg(id), array[]::uuid[]) into existing_ids
      from public.award_categories where season_id = target_season_id;
    select coalesce(array_agg((c->>'id')::uuid), array[]::uuid[]) into keep_ids
      from jsonb_array_elements(req.payload->'categories') c;

    delete from public.award_categories
      where season_id = target_season_id and not (id = any(keep_ids));

    for cat in select * from jsonb_array_elements(req.payload->'categories')
    loop
      if (cat->>'id')::uuid = any(existing_ids) then
        update public.award_categories set
          title = cat->>'title', description = cat->>'description', sort_order = (cat->>'sort_order')::int
        where id = (cat->>'id')::uuid;
      else
        insert into public.award_categories (id, season_id, title, description, sort_order)
        values ((cat->>'id')::uuid, target_season_id, cat->>'title', cat->>'description', (cat->>'sort_order')::int);
      end if;
    end loop;
  end if;

  update public.change_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
end;
$$;

-- tighten direct writes on gated tables to owner-only (regular admins go through the queue)
drop policy news_admin_insert on public.news;
create policy news_admin_insert on public.news
  for insert with check (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));
drop policy news_admin_update on public.news;
create policy news_admin_update on public.news
  for update using (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));

drop policy events_admin_insert on public.events;
create policy events_admin_insert on public.events
  for insert with check (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));
drop policy events_admin_update on public.events;
create policy events_admin_update on public.events
  for update using (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));

drop policy award_seasons_insert_admin on public.award_seasons;
create policy award_seasons_insert_admin on public.award_seasons
  for insert with check (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));
drop policy award_seasons_update_admin on public.award_seasons;
create policy award_seasons_update_admin on public.award_seasons
  for update using (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));

drop policy award_categories_insert_admin on public.award_categories;
create policy award_categories_insert_admin on public.award_categories
  for insert with check (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));
drop policy award_categories_update_admin on public.award_categories;
create policy award_categories_update_admin on public.award_categories
  for update using (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));

-- seed the sole existing account as the first owner
-- (original used the owner's email address; replace <OWNER_EMAIL> with the real one when restoring)
insert into public.admins (user_id, is_owner)
select id, true from auth.users where email = '<OWNER_EMAIL>'
on conflict (user_id) do update set is_owner = true;

-- ===== 20260905090755_fix_admins_rls_recursion =====
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_owner() returns boolean
language sql security definer stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and is_owner);
$$;

drop policy admins_select_admin_all on public.admins;
create policy admins_select_admin_all on public.admins
  for select using (public.is_admin());

drop policy admins_insert_admin on public.admins;
create policy admins_insert_admin on public.admins
  for insert with check (is_owner = false or public.is_owner());

drop policy admins_delete_admin on public.admins;
create policy admins_delete_admin on public.admins
  for delete using (public.is_owner());

-- ===== 20260905093535_allow_any_entry_year_in_matric_number =====
alter table public.profiles drop constraint profiles_student_id_check;
alter table public.profiles add constraint profiles_student_id_check check (student_id ~ '^[0-9]{2}0406[0-9]{3}$'::text);
