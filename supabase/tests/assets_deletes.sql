-- AssetNXG v2 · assets: "in use" guards and deletes (run in the Supabase SQL
-- editor; the MCP tool declines statements that delete). Leaves NOTHING
-- behind. "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_tech    uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  room_a    uuid;
  sub_a     uuid;
  vend_a    uuid;
  a1        uuid;
  n         int;
  report    text := '';
  passed    int := 0;
  failed    int := 0;
  ok        boolean;
  label     text;
begin
  insert into auth.users (id, email) values
    (u_admin, 'admin@test.invalid'), (u_tech, 'tech@test.invalid'), (u_admin_b, 'adminb@test.invalid');
  insert into public.organizations (id, name, short_name, slug) values
    (org_a, 'Test Org A', 'TOA', 'zz-test-a'), (org_b, 'Test Org B', 'TOB', 'zz-test-b');
  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin, '{admin}'), (org_a, u_tech, '{technician}'), (org_b, u_admin_b, '{admin}');

  with c as (insert into public.campuses (organization_id, name) values (org_a, 'Main') returning id),
       b as (insert into public.buildings (organization_id, campus_id, name) select org_a, id, 'Block A' from c returning id)
  insert into public.rooms (organization_id, building_id, name) select org_a, id, 'Room 1' from b returning id into room_a;
  with c as (insert into public.categories (organization_id, name) values (org_a, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name) select org_a, id, 'Split AC' from c returning id into sub_a;
  insert into public.vendors (organization_id, name) values (org_a, 'Cool Air') returning id into vend_a;
  insert into public.assets (organization_id, name, sub_category_id, room_id, purchased_from_id, assigned_to)
  values (org_a, 'AC 1', sub_a, room_a, vend_a, u_tech) returning id into a1;

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  label := 'a room with assets cannot be deleted (plain reason)';
  begin delete from public.rooms where id = room_a; ok := false;
  exception when foreign_key_violation then ok := sqlerrm = 'There is 1 asset in this room. Move them to another room first.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a sub-category with assets cannot be deleted (plain reason)';
  begin delete from public.sub_categories where id = sub_a; ok := false;
  exception when foreign_key_violation then ok := sqlerrm = '1 asset uses this sub-category. Change their sub-category first.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a vendor assets were bought from cannot be deleted (plain reason)';
  begin delete from public.vendors where id = vend_a; ok := false;
  exception when foreign_key_violation then ok := sqlerrm = '1 asset was bought from this vendor, so it can''t be deleted.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  delete from public.memberships where organization_id = org_a and user_id = u_tech;
  select count(*) into n from public.assets where id = a1 and assigned_to is null;
  ok := n = 1;
  label := 'someone removed from the client is no longer assigned its assets';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';
  delete from public.assets where id = a1;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'another client''s Admin cannot delete A''s assets';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';
  delete from public.assets where id = a1;
  delete from public.rooms where id = room_a;
  select (select count(*) from public.assets where id = a1) + (select count(*) from public.rooms where id = room_a) into n;
  ok := n = 0;
  label := 'once the asset is gone, its room can be deleted';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
