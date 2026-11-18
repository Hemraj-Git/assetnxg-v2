-- AssetNXG v2 · contracts tests: CON- numbers, one contract covering many
-- assets, overlap rules (same group refused, warranty + AMC allowed),
-- renewals, vendor rules, same-client assets, who may read and write.
-- Deletes: see contracts_deletes.sql (SQL editor).
--
-- Leaves NOTHING behind. "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_tech    uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  room_a    uuid;
  room_b    uuid;
  sub_a     uuid;
  sub_b     uuid;
  vend      uuid;
  a1        uuid;
  a2        uuid;
  a3        uuid;
  b1        uuid;
  amc       uuid;
  renewal   uuid;
  v_code    text;
  ids       uuid[];
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
  with c as (insert into public.campuses (organization_id, name) values (org_b, 'B') returning id),
       b as (insert into public.buildings (organization_id, campus_id, name) select org_b, id, 'B' from c returning id)
  insert into public.rooms (organization_id, building_id, name) select org_b, id, 'B' from b returning id into room_b;
  with c as (insert into public.categories (organization_id, name) values (org_b, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name) select org_b, id, 'B AC' from c returning id into sub_b;
  insert into public.vendors (organization_id, name) values (org_a, 'Cool Air') returning id into vend;
  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_a, 'AC 1', sub_a, room_a) returning id into a1;
  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_a, 'AC 2', sub_a, room_a) returning id into a2;
  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_a, 'AC 3', sub_a, room_a) returning id into a3;
  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_b, 'B AC', sub_b, room_b) returning id into b1;

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  insert into public.contracts (organization_id, kind, vendor_id, contract_no, starts_on, ends_on, cost, asset_ids)
  values (org_a, 'amc', vend, ' AMC/26/017 ', '2026-04-01', '2027-03-31', 48000, array[a1, a2, a3, a1])
  returning id, code, asset_ids into amc, v_code, ids;
  ok := v_code = 'CON-0001' and cardinality(ids) = 3;
  label := 'one contract covers several assets (CON-0001, 3 assets, repeats dropped)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an AMC needs a vendor';
  begin insert into public.contracts (organization_id, kind, starts_on, ends_on, asset_ids) values (org_a, 'camc', '2028-01-01', '2028-12-31', array[a1]); ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.contracts (organization_id, kind, starts_on, ends_on, asset_ids) values (org_a, 'warranty', '2024-03-12', '2027-03-14', array[a1]);
  get diagnostics n = row_count;
  ok := n = 1;
  label := 'a warranty needs no vendor, and may overlap an AMC';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'the same asset in two overlapping AMCs is refused, naming the asset and contract';
  begin insert into public.contracts (organization_id, kind, vendor_id, starts_on, ends_on, asset_ids) values (org_a, 'amc', vend, '2027-01-01', '2027-12-31', array[a2]); ok := false;
  exception when invalid_parameter_value then ok := sqlerrm like 'AST-0002 is already covered by CON-0001 from 01-04-2026 to 31-03-2027%'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a comprehensive AMC overlapping an AMC is refused too (same group)';
  begin insert into public.contracts (organization_id, kind, vendor_id, starts_on, ends_on, asset_ids) values (org_a, 'camc', vend, '2026-06-01', '2026-12-31', array[a3]); ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.contracts (organization_id, kind, vendor_id, starts_on, ends_on, asset_ids, renewed_from_id)
  values (org_a, 'amc', vend, '2027-04-01', '2028-03-31', array[a1, a2], amc) returning id into renewal;
  ok := renewal is not null;
  label := 'a renewal for the next period carries on (and can drop an asset)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a contract is renewed only once';
  begin insert into public.contracts (organization_id, kind, vendor_id, starts_on, ends_on, asset_ids, renewed_from_id)
        values (org_a, 'amc', vend, '2028-04-01', '2029-03-31', array[a3], amc); ok := false;
  exception when unique_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a warranty cannot be a renewal of an AMC';
  begin insert into public.contracts (organization_id, kind, starts_on, ends_on, asset_ids, renewed_from_id)
        values (org_a, 'warranty', '2030-01-01', '2030-12-31', array[a3], renewal); ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'what a contract renews cannot be changed later';
  begin update public.contracts set renewed_from_id = null where id = renewal; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an end before the start is refused';
  begin update public.contracts set ends_on = '2026-01-01' where id = amc; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a contract must cover at least one asset';
  begin update public.contracts set asset_ids = '{}' where id = amc; ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an asset of another client is refused';
  begin update public.contracts set asset_ids = array[a1, b1] where id = amc; ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.contracts set not_renewing = true, contract_no = ' AMC/26/017-A ' where id = amc;
  select count(*) into n from public.contracts where id = amc and not_renewing and contract_no = 'AMC/26/017-A';
  ok := n = 1;
  label := 'a contract can be marked "not renewing"; details are trimmed';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a contract number (CON-) cannot be changed';
  begin update public.contracts set code = 'CON-9999' where id = amc; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.contracts where organization_id = org_a and asset_ids @> array[a1];
  ok := n = 3;
  label := 'an asset''s contracts are found by the asset (warranty, AMC, renewal)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.audit_log where table_name = 'contracts' and record_id = amc and actor_id = u_admin;
  ok := n = 2;
  label := 'contract changes are in the audit log with who made them';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Technician of A ─────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.contracts where organization_id = org_a;
  ok := n = 3;
  label := 'staff can read their client''s contracts';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff who are not Admin cannot add contracts';
  begin insert into public.contracts (organization_id, kind, starts_on, ends_on, asset_ids) values (org_a, 'warranty', '2031-01-01', '2031-12-31', array[a3]); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Admin of B ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.contracts where organization_id = org_a;
  ok := n = 0;
  label := 'another client''s Admin sees none of A''s contracts';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'another client cannot put A''s assets in its contract';
  begin insert into public.contracts (organization_id, kind, starts_on, ends_on, asset_ids) values (org_b, 'warranty', '2026-01-01', '2026-12-31', array[a1]); ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Anonymous ───────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.headers', '', true);
  execute 'set local role anon';
  label := 'signed-out visitors cannot read contracts';
  begin select count(*) into n from public.contracts; ok := n = 0;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
