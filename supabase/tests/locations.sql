-- AssetNXG v2 · locations tests: numbers, trimming, unique names, QR keys,
-- same-client links, moves, room types per client, who may read and write.
-- Delete guards are in locations_deletes.sql (run in the SQL editor).
--
-- Like the other files here: leaves NOTHING behind (ends by raising the
-- report, which rolls everything back). "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_tech    uuid := gen_random_uuid();
  u_guest   uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  c_main    uuid;
  c_north   uuid;
  b_a       uuid;
  b_b       uuid;
  c_other   uuid;
  b_other   uuid;
  t_class   uuid;
  t_other   uuid;
  r1        uuid;
  code1     text;
  code2     text;
  key1      text;
  n         int;
  report    text := '';
  passed    int := 0;
  failed    int := 0;
  ok        boolean;
  label     text;
begin
  -- ── Setup (as the server) ───────────────────────────────────────────────
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_admin,   'admin@test.invalid',  '{"full_name":"Admin"}'),
    (u_tech,    'tech@test.invalid',   '{"full_name":"Tech"}'),
    (u_guest,   'guest@test.invalid',  '{"full_name":"Guest"}'),
    (u_admin_b, 'adminb@test.invalid', '{"full_name":"Admin B"}');
  insert into public.organizations (id, name, short_name, slug) values
    (org_a, 'Test Org A', 'TOA', 'zz-test-a'),
    (org_b, 'Test Org B', 'TOB', 'zz-test-b');
  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin, '{admin}'), (org_a, u_tech, '{technician}'),
    (org_a, u_guest, '{guest}'), (org_b, u_admin_b, '{admin}');

  select count(*) into n from public.room_types where organization_id = org_a;
  ok := n = 7;
  label := 'a new client starts with 7 room types';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select id into t_other from public.room_types where organization_id = org_b and name = 'Classroom';

  -- ── Admin of A ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  insert into public.campuses (organization_id, name, address) values (org_a, ' Main campus ', '  ') returning id, code into c_main, code1;
  insert into public.campuses (organization_id, name) values (org_a, 'North campus') returning id, code into c_north, code2;
  ok := code1 = 'CAM-0001' and code2 = 'CAM-0002';
  label := 'campus numbers come from the database (CAM-0001, CAM-0002)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.campuses where id = c_main and name = 'Main campus' and address is null;
  ok := n = 1;
  label := 'names are trimmed and a blank address is empty';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'campus names are unique per client, ignoring case';
  begin insert into public.campuses (organization_id, name) values (org_a, 'MAIN CAMPUS'); ok := false;
  exception when unique_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.buildings (organization_id, campus_id, name, total_floors) values (org_a, c_main, 'Block A', 4) returning id, code into b_a, code1;
  insert into public.buildings (organization_id, campus_id, name) values (org_a, c_main, 'Block B') returning id into b_b;
  ok := code1 = 'BLD-0001';
  label := 'building numbers come from the database (BLD-0001)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'building names are unique within a campus';
  begin insert into public.buildings (organization_id, campus_id, name) values (org_a, c_main, 'block a'); ok := false;
  exception when unique_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.buildings (organization_id, campus_id, name) values (org_a, c_north, 'Block A');
  get diagnostics n = row_count;
  ok := n = 1;
  label := 'the same building name is fine on another campus';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select id into t_class from public.room_types where organization_id = org_a and name = 'classroom';
  insert into public.rooms (organization_id, building_id, name, room_type_id, floor, area_sqft)
  values (org_a, b_a, 'Classroom 204', t_class, ' 2 ', 650) returning id, code, qr_key into r1, code1, key1;
  insert into public.rooms (organization_id, building_id, name) values (org_a, b_a, 'Store') returning code into code2;
  ok := code1 = 'ROM-0001' and code2 = 'ROM-0002' and length(key1) = 32;
  label := 'room numbers come from the database and each room gets a QR key';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.rooms where id = r1 and floor = '2' and status = 'available' and is_reservable;
  ok := n = 1;
  label := 'a new room is available and reservable; floor is trimmed';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'room numbers and QR keys cannot be changed';
  begin update public.rooms set qr_key = 'guessable' where id = r1; ok := false;
  exception when insufficient_privilege then ok := true; end;
  if ok then
    begin update public.rooms set code = 'ROM-9999' where id = r1; ok := false;
    exception when insufficient_privilege then ok := true; end;
  end if;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.rooms set building_id = b_b, status = 'under_maintenance', name = 'Classroom 204 ' where id = r1;
  select count(*) into n from public.rooms where id = r1 and building_id = b_b and code = 'ROM-0001' and qr_key = key1 and name = 'Classroom 204';
  ok := n = 1;
  label := 'a room moves to another building and keeps its number and QR key';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.buildings set campus_id = c_north where id = b_b;
  get diagnostics n = row_count;
  ok := n = 1;
  label := 'a building moves to another campus';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a room cannot use another client''s room type';
  begin update public.rooms set room_type_id = t_other where id = r1; ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'room types are unique per client, ignoring case';
  begin insert into public.room_types (organization_id, name) values (org_a, 'WASHROOM'); ok := false;
  exception when unique_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.room_types (organization_id, name) values (org_a, ' Simulator room ');
  select count(*) into n from public.room_types where organization_id = org_a and name = 'Simulator room' and created_by = u_admin;
  ok := n = 1;
  label := 'an Admin adds a room type (trimmed; who added it is recorded)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a negative area is refused';
  begin update public.rooms set area_sqft = -1 where id = r1; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.audit_log where table_name = 'rooms' and record_id = r1 and actor_id = u_admin;
  ok := n = 2;
  label := 'room changes are in the audit log with who made them';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Technician of A ─────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.rooms where organization_id = org_a;
  ok := n = 2;
  label := 'staff can read their client''s rooms';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff who are not Admin cannot add rooms';
  begin insert into public.rooms (organization_id, building_id, name) values (org_a, b_a, 'Sneaky'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.rooms set name = 'Renamed' where id = r1;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'staff who are not Admin cannot rename rooms';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Guest of A ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_guest, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.rooms;
  ok := n = 0;
  label := 'guests cannot list rooms (QR scans use their own lookup)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Admin of B ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';

  select (select count(*) from public.campuses where organization_id = org_a)
       + (select count(*) from public.buildings where organization_id = org_a)
       + (select count(*) from public.rooms where organization_id = org_a)
       + (select count(*) from public.room_types where organization_id = org_a) into n;
  ok := n = 0;
  label := 'another client''s Admin sees none of A''s locations';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.rooms set name = 'Hacked' where id = r1;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'another client''s Admin cannot change A''s rooms';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.campuses (organization_id, name) values (org_b, 'B campus') returning id into c_other;
  label := 'a building cannot be put on another client''s campus';
  begin insert into public.buildings (organization_id, campus_id, name) values (org_b, c_main, 'Sneaky'); ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.buildings (organization_id, campus_id, name) values (org_b, c_other, 'B block') returning id, code into b_other, code1;
  ok := code1 = 'BLD-0001';
  label := 'numbers restart for each client (B''s first building is BLD-0001)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a room cannot be put in another client''s building';
  begin insert into public.rooms (organization_id, building_id, name) values (org_b, b_a, 'Sneaky'); ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Anonymous ───────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.headers', '', true);
  execute 'set local role anon';
  label := 'signed-out visitors cannot read rooms';
  begin select count(*) into n from public.rooms; ok := n = 0;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
