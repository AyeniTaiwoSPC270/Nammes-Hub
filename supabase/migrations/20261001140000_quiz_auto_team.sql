-- "Put me anywhere" in team mode: pick the smallest team and assign the player in one locked step, so phones that join
-- in the same instant are spread across the teams instead of all landing on the same one. Server only.
create or replace function public.quiz_assign_auto_team(p_session uuid, p_player uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare picked uuid;
begin
  perform pg_advisory_xact_lock(hashtext('quiz_team:' || p_session::text));
  select t.id into picked
    from public.quiz_teams t
   where t.session_id = p_session
   order by (select count(*) from public.quiz_players p where p.team_id = t.id and p.id <> p_player), t.position
   limit 1;
  if picked is null then return null; end if;
  update public.quiz_players set team_id = picked where id = p_player and session_id = p_session;
  return picked;
end;
$$;
revoke execute on function public.quiz_assign_auto_team(uuid, uuid) from public, anon, authenticated;
grant execute on function public.quiz_assign_auto_team(uuid, uuid) to service_role;
