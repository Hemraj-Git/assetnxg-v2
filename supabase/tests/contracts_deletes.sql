-- AssetNXG v2 · contracts: deletes (run in the Supabase SQL editor; the MCP
-- tool declines statements that delete). Leaves NOTHING behind.
-- "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  room_a    uuid;
  sub_a     uuid;
  vend      uuid;
  a1        uuid;
  a2        uuid;
  amc       uuid;
  renewal   uuid;
  ids       uuid[];
  n         int;
  report    text := '';
  passed    int := 0;
  failed    int := 0;
  ok        boolean;
  label     text;
begin
  insert into auth.users (id, email) values (u_admin, 'admin@test.invalid'), (u_admin_b, 'adminb@test.invalid');
  insert into public.organizations (id, name, short_name, slug) values
    (org_a, 'Test Org A', 'TOA', 'zz-test-a'), (org_b, 'Test Org B', 'TOB', 'zz-test-b');
  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin, '{admin}'), (org_b, u_admin_b, '{admin}');
  with c as (insert into public.campuses (organization_id, name) values (org_a, 'Main') returning id),
       b as (insert into public.buildings (organization_id, campus_id, name) select org_a, id, 'Block A' from c returning id)
  insert into public.rooms (organization_id, building_id, name) select org_a, id, 'Room 1' from b returning id into room_a;
  with c as (insert into public.categories (organization_id, name) values (org_a, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name) select org_a, id, 'Split AC' from c returning id into sub_a;
  insert into public.vendors (organization_id, name) values (org_a, 'Cool Air') returning id into vend;
  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_a, 'AC 1', sub_a, room_a) returning id into a1;
  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_a, 'AC 2', sub_a, room_a) returning id into a2;
  insert into public.contracts (organization_id, kind, vendor_id, starts_on, ends_on, asset_ids)
  values (org_a, 'amc', vend, '2026-04-01', '2027-03-31', array[a1, a2]) returning id into amc;
  insert into public.contracts (organization_id, kind, vendor_id, starts_on, ends_on, asset_ids, renewed_from_id)
  values (org_a, 'amc', vend, '2027-04-01', '2028-03-31', array[a1], amc) returning id into renewal;

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  label := 'a vendor with contracts cannot be deleted (plain reason)';
  begin delete from public.vendors where id = vend; ok := false;
  exception when foreign_key_violation then ok := sqlerrm = 'This vendor has 2 contracts (warranty or AMC), so it can''t be deleted.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  delete from public.assets where id = a2;
  select asset_ids into ids from public.contracts where id = amc;
  ok := ids = array[a1];
  label := 'an asset deleted by mistake drops out of its contracts';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';
  delete from public.contracts where id = amc;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'another client''s Admin cannot delete A''s contracts';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';
  delete from public.contracts where id = amc;
  select count(*) into n from public.contracts where id = renewal and renewed_from_id is null;
  ok := n = 1;
  label := 'deleting a contract keeps its renewal (the link is cleared)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
