-- AssetNXG v2 · locations delete guards (run in the Supabase SQL editor; the
-- MCP tool declines statements that delete, even inside a rolled-back test).
-- Refused while used, with a plain reason; allowed once empty; never across
-- clients. Leaves NOTHING behind. "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  c1        uuid;
  b1        uuid;
  r1        uuid;
  t1        uuid;
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

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  insert into public.campuses (organization_id, name) values (org_a, 'Main') returning id into c1;
  insert into public.buildings (organization_id, campus_id, name) values (org_a, c1, 'Block A') returning id into b1;
  insert into public.room_types (organization_id, name) values (org_a, 'Test type') returning id into t1;
  insert into public.rooms (organization_id, building_id, name, room_type_id) values (org_a, b1, 'Room 1', t1) returning id into r1;
  execute 'reset role';

  -- Another client's Admin deletes nothing in A.
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';
  delete from public.rooms where id = r1;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'another client''s Admin cannot delete A''s rooms';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  label := 'a campus with buildings cannot be deleted (plain reason)';
  begin delete from public.campuses where id = c1; ok := false;
  exception when foreign_key_violation then ok := sqlerrm = 'Move or delete its buildings first.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a building with rooms cannot be deleted (plain reason)';
  begin delete from public.buildings where id = b1; ok := false;
  exception when foreign_key_violation then ok := sqlerrm = 'Move or delete its rooms first.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a room type in use cannot be deleted (plain reason)';
  begin delete from public.room_types where id = t1; ok := false;
  exception when foreign_key_violation then ok := sqlerrm = 'Rooms use this type. Give them another type first.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  delete from public.rooms where id = r1;
  delete from public.room_types where id = t1;
  delete from public.buildings where id = b1;
  delete from public.campuses where id = c1;
  select (select count(*) from public.rooms where id = r1) + (select count(*) from public.room_types where id = t1)
       + (select count(*) from public.buildings where id = b1) + (select count(*) from public.campuses where id = c1) into n;
  ok := n = 0;
  label := 'once empty, room, room type, building and campus can be deleted';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  select count(*) into n from public.audit_log where table_name = 'rooms' and record_id = r1 and action = 'delete' and actor_id = u_admin;
  ok := n = 1;
  label := 'deletes are in the audit log with who made them';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
