-- AssetNXG v2 · assets tests: AST- numbers, specifications follow the
-- sub-category, date rules, installation date locked, retiring, assignee
-- must be staff, same-client links, who may read and write.
-- Deletes and "in use" guards: see assets_deletes.sql (SQL editor).
--
-- Leaves NOTHING behind. "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_tech    uuid := gen_random_uuid();
  u_guest   uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  room_a    uuid;
  room_b    uuid;
  sub_ac    uuid;
  sub_fan   uuid;
  sub_b     uuid;
  vend_a    uuid;
  vend_b    uuid;
  a1        uuid;
  v_code    text;
  r         record;
  n         int;
  today     date;
  report    text := '';
  passed    int := 0;
  failed    int := 0;
  ok        boolean;
  label     text;
begin
  insert into auth.users (id, email) values
    (u_admin, 'admin@test.invalid'), (u_tech, 'tech@test.invalid'), (u_guest, 'guest@test.invalid'), (u_admin_b, 'adminb@test.invalid');
  insert into public.organizations (id, name, short_name, slug) values
    (org_a, 'Test Org A', 'TOA', 'zz-test-a'), (org_b, 'Test Org B', 'TOB', 'zz-test-b');
  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin, '{admin}'), (org_a, u_tech, '{technician}'), (org_a, u_guest, '{guest}'), (org_b, u_admin_b, '{admin}');

  -- Masters (as the server)
  with c as (insert into public.campuses (organization_id, name) values (org_a, 'Main') returning id),
       b as (insert into public.buildings (organization_id, campus_id, name) select org_a, id, 'Block A' from c returning id)
  insert into public.rooms (organization_id, building_id, name) select org_a, id, 'Classroom 204' from b returning id into room_a;
  with c as (insert into public.campuses (organization_id, name) values (org_b, 'B main') returning id),
       b as (insert into public.buildings (organization_id, campus_id, name) select org_b, id, 'B block' from c returning id)
  insert into public.rooms (organization_id, building_id, name) select org_b, id, 'B room' from b returning id into room_b;
  with c as (insert into public.categories (organization_id, name) values (org_a, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name, sla_priority, asset_fields)
  select org_a, id, 'Split AC', 'high',
    '[{"key":"cap","label":"Capacity","type":"number","unit":"ton","required":true},
      {"key":"made","label":"Made on","type":"date","required":false},
      {"key":"gas","label":"Refrigerant","type":"text","required":false}]'::jsonb
  from c returning id into sub_ac;
  insert into public.sub_categories (organization_id, category_id, name)
  select org_a, category_id, 'Fans' from public.sub_categories where id = sub_ac returning id into sub_fan;
  with c as (insert into public.categories (organization_id, name) values (org_b, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name) select org_b, id, 'B AC' from c returning id into sub_b;
  insert into public.vendors (organization_id, name) values (org_a, 'Cool Air') returning id into vend_a;
  insert into public.vendors (organization_id, name) values (org_b, 'B vendor') returning id into vend_b;
  today := private.org_today(org_a);

  -- ── Admin of A ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  insert into public.assets (organization_id, name, sub_category_id, room_id, purchase_date, installation_date, purchased_from_id, assigned_to, spec_values)
  values (org_a, ' Split AC 1.5 Ton ', sub_ac, room_a, '2024-03-02', '2024-03-12', vend_a, u_tech,
          '{"cap": 1.5, "gas": "  R32 ", "made": "2023-12-01", "colour": "white"}')
  returning id, code into a1, v_code;
  ok := v_code = 'AST-0001';
  label := 'asset numbers come from the database (AST-0001)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select * into r from public.assets where id = a1;
  ok := r.name = 'Split AC 1.5 Ton' and r.created_by = u_admin and r.status = 'operational' and length(r.qr_key) = 32;
  label := 'a new asset is trimmed, operational, has a QR key and records who added it';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  ok := r.spec_values = '{"cap": 1.5, "gas": "R32", "made": "2023-12-01"}'::jsonb;
  label := 'specifications keep only the sub-category''s fields, trimmed';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.assets (organization_id, name, sub_category_id, room_id, spec_values)
  values (org_a, 'Second', sub_ac, room_a, '{"cap": 2}') returning code into v_code;
  ok := v_code = 'AST-0002';
  label := 'the next asset is AST-0002';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a required specification must be filled';
  begin insert into public.assets (organization_id, name, sub_category_id, room_id, spec_values) values (org_a, 'X', sub_ac, room_a, '{"cap": " "}'); ok := false;
  exception when invalid_parameter_value then ok := sqlerrm = 'Fill in “Capacity”.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a number field refuses text';
  begin update public.assets set spec_values = '{"cap": "big"}' where id = a1; ok := false;
  exception when invalid_parameter_value then ok := sqlerrm = '“Capacity” must be a number.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a date field refuses a date that doesn''t exist';
  begin update public.assets set spec_values = '{"cap": 1, "made": "2026-02-31"}' where id = a1; ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.assets set sub_category_id = sub_fan where id = (select id from public.assets where code = 'AST-0002' and organization_id = org_a);
  select count(*) into n from public.assets where code = 'AST-0002' and organization_id = org_a and spec_values = '{}'::jsonb;
  ok := n = 1;
  label := 'moving to another sub-category keeps only that sub-category''s fields';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.assets set installation_date = '2025-01-01' where id = a1;
  select count(*) into n from public.assets where id = a1 and installation_date = '2024-03-12';
  ok := n = 1;
  label := 'the installation date is locked once set';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'installation before purchase is refused';
  begin insert into public.assets (organization_id, name, sub_category_id, room_id, purchase_date, installation_date, spec_values)
        values (org_a, 'X', sub_ac, room_a, '2024-03-02', '2024-02-28', '{"cap": 1}'); ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a purchase date in the future is refused';
  begin update public.assets set purchase_date = today + 1 where id = a1; ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'last serviced before installation is refused';
  begin update public.assets set last_serviced_on = '2024-01-01' where id = a1; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.assets set status = 'retired', retire_reason = 'Beyond repair' where id = a1;
  select * into r from public.assets where id = a1;
  ok := r.retired_on = today and r.retire_reason = 'Beyond repair';
  label := 'retiring records the day (client''s today) and the reason';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.assets set status = 'operational' where id = a1;
  select * into r from public.assets where id = a1;
  ok := r.retired_on is null and r.retire_reason is null;
  label := 'bringing it back clears the retirement';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a guest cannot be assigned an asset';
  begin update public.assets set assigned_to = u_guest where id = a1; ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a room of another client is refused';
  begin update public.assets set room_id = room_b where id = a1; ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a sub-category of another client is refused';
  begin update public.assets set sub_category_id = sub_b where id = a1; ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a vendor of another client is refused';
  begin update public.assets set purchased_from_id = vend_b where id = a1; ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'the number and QR key cannot be changed';
  begin update public.assets set code = 'AST-9999' where id = a1; ok := false;
  exception when insufficient_privilege then ok := true; end;
  if ok then
    begin update public.assets set qr_key = 'x' where id = a1; ok := false;
    exception when insufficient_privilege then ok := true; end;
  end if;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.audit_log where table_name = 'assets' and record_id = a1 and actor_id = u_admin;
  ok := n >= 3;
  label := 'asset changes are in the audit log with who made them';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Technician of A ─────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.assets where organization_id = org_a;
  ok := n = 2;
  label := 'staff can read their client''s assets';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.assets set name = 'Renamed' where id = a1;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'staff who are not Admin cannot change assets';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Guest of A ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_guest, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.assets;
  ok := n = 0;
  label := 'guests cannot list assets (QR scans use their own lookup)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Admin of B ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.assets where organization_id = org_a;
  ok := n = 0;
  label := 'another client''s Admin sees none of A''s assets';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_b, 'B asset', sub_b, room_b) returning code into v_code;
  ok := v_code = 'AST-0001';
  label := 'numbers restart for each client (B''s first asset is AST-0001)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Anonymous ───────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.headers', '', true);
  execute 'set local role anon';
  label := 'signed-out visitors cannot read assets';
  begin select count(*) into n from public.assets; ok := n = 0;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
