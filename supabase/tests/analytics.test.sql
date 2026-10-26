-- Rolled back: ends with a raise exception so nothing persists.
--
-- Checks the three things a later `create or replace` could quietly undo: that an anonymous client
-- cannot read page_views, that the beacon drops what it is told to drop and dedupes a double effect,
-- and that the dashboard refuses a signed-in account that is not an admin.
do $$
declare
  v_visitor text := '0f8fad5b-d9cb-469f-a165-70867728950e';
  v_random uuid := gen_random_uuid();
  n int;
  ok boolean;
  msg text;
begin
  -- ===== The admin area is not a page view =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  perform public.record_page_view('/admin/analytics', v_visitor, null, 'anon');
  reset role;
  select count(*) into n from public.page_views where visitor = v_visitor;
  assert n = 0, 'record_page_view accepted an admin path';

  -- ===== Query strings and duplicates =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  perform public.record_page_view('/news/abc?utm_source=x', v_visitor, 'google.com', 'anon');
  perform public.record_page_view('/news/abc', v_visitor, 'google.com', 'anon');
  reset role;
  select count(*) into n from public.page_views where visitor = v_visitor;
  assert n = 1, 'the same view was stored twice or the query string was kept';
  select count(*) into n from public.page_views where visitor = v_visitor and path = '/news/abc';
  assert n = 1, 'the stored path is not the normalised one';

  -- ===== An anonymous client cannot read the table =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    perform count(*) from public.page_views;
    ok := false;
    msg := 'anon read page_views';
  exception when insufficient_privilege then
    ok := true;
    msg := 'blocked';
  end;
  reset role;
  assert ok, msg;

  -- ===== A signed-in non-admin cannot open the dashboard =====
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_random::text, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
  begin
    perform public.admin_analytics(30);
    ok := false;
    msg := 'a non-admin read the dashboard';
  exception when others then
    ok := sqlerrm like '%Only admins%';
    msg := sqlerrm;
  end;
  reset role;
  assert ok, msg;

  raise exception 'ROLLBACK_OK all assertions passed';
end $$;
