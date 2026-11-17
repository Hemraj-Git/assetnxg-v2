-- AssetNXG v2 · people and departments tests: numbering, tree without loops,
-- heads are staff of the same client, delete guards, one client per request,
-- adding people by email, keep-an-Admin and no-self-removal guards.
--
-- Like the other files here: leaves NOTHING behind (ends by raising the
-- report, which rolls everything back). "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a      uuid := gen_random_uuid();
  org_b      uuid := gen_random_uuid();
  u_admin_a  uuid := gen_random_uuid();
  u_admin2_a uuid := gen_random_uuid();
  u_tech_a   uuid := gen_random_uuid();
  u_head_a   uuid := gen_random_uuid();
  u_guest_a  uuid := gen_random_uuid();
  u_support  uuid := gen_random_uuid();  -- @assetnxg.app, support access in A
  u_admin_b  uuid := gen_random_uuid();
  u_loose    uuid := gen_random_uuid();  -- an account in no client
  d_top      uuid;
  d_child    uuid;
  d_leaf     uuid;
  d_b        uuid;
  code_top   text;
  code_child text;
  res        text;
  n          int;
  report     text := '';
  passed     int := 0;
  failed     int := 0;
  ok         boolean;
  label      text;
begin
  -- ── Setup (as the server) ───────────────────────────────────────────────
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_admin_a,  'admin.a@test.invalid',  '{"full_name":"Admin A"}'),
    (u_admin2_a, 'admin2.a@test.invalid', '{"full_name":"Admin Two A"}'),
    (u_tech_a,   'tech.a@test.invalid',   '{"full_name":"Tech A"}'),
    (u_head_a,   'head.a@test.invalid',   '{"full_name":"Head A"}'),
    (u_guest_a,  'guest.a@test.invalid',  '{"full_name":"Guest A"}'),
    (u_support,  'zz-support@assetnxg.app', '{"full_name":"Support"}'),
    (u_admin_b,  'admin.b@test.invalid',  '{"full_name":"Admin B"}'),
    (u_loose,    'loose@test.invalid',    '{"full_name":"Loose"}');
  insert into public.organizations (id, name, short_name, slug) values
    (org_a, 'Test Org A', 'TOA', 'zz-test-a'),
    (org_b, 'Test Org B', 'TOB', 'zz-test-b');
  insert into public.memberships (organization_id, user_id, roles, support_access) values
    (org_a, u_admin_a,  '{admin}', false),
    (org_a, u_admin2_a, '{admin}', false),
    (org_a, u_tech_a,   '{technician}', false),
    (org_a, u_head_a,   '{faculty}', false),
    (org_a, u_guest_a,  '{guest}', false),
    (org_a, u_support,  '{admin}', true),
    (org_b, u_admin_b,  '{admin}', false);

  -- ── First sign-in ───────────────────────────────────────────────────────
  update auth.users set last_sign_in_at = now() where id = u_tech_a;
  select count(*) into n from public.profiles
  where id = u_tech_a and first_signed_in_at is not null;
  ok := n = 1;
  label := 'first sign-in is recorded on the profile (ends "Invite pending")';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- ── Admin of A, on A's address ──────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  insert into public.departments (organization_id, name) values (org_a, '  Academics ')
    returning id, code into d_top, code_top;
  insert into public.departments (organization_id, name, parent_id) values (org_a, 'Marine Engineering', d_top)
    returning id, code into d_child, code_child;
  insert into public.departments (organization_id, name, parent_id) values (org_a, 'Workshop', d_child)
    returning id into d_leaf;

  ok := code_top = 'DEP-0001' and code_child = 'DEP-0002';
  label := 'department numbers come from the database (DEP-0001, DEP-0002)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.departments where id = d_top and name = 'Academics';
  ok := n = 1;
  label := 'names are trimmed';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'names are unique per client, ignoring case';
  begin insert into public.departments (organization_id, name) values (org_a, 'ACADEMICS'); ok := false;
  exception when unique_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a department number cannot be changed';
  begin update public.departments set code = 'DEP-9999' where id = d_top; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a department cannot sit under one of its own sub-departments';
  begin update public.departments set parent_id = d_leaf where id = d_top; ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a department cannot sit under itself';
  begin update public.departments set parent_id = d_top where id = d_top; ok := false;
  exception when check_violation or invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.departments set head_user_id = u_head_a where id = d_child;
  select count(*) into n from public.departments where id = d_child and head_user_id = u_head_a;
  ok := n = 1;
  label := 'a staff member can be made head of a department';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a guest cannot be head of a department';
  begin update public.departments set head_user_id = u_guest_a where id = d_top; ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a support login cannot be head of a department';
  begin update public.departments set head_user_id = u_support where id = d_top; ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'someone from another client cannot be head of a department';
  begin update public.departments set head_user_id = u_admin_b where id = d_top; ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.memberships set department_id = d_leaf where organization_id = org_a and user_id = u_tech_a;
  select count(*) into n from public.memberships where user_id = u_tech_a and department_id = d_leaf;
  ok := n = 1;
  label := 'an Admin sets a person''s department';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a department with people cannot be deleted (plain reason)';
  begin delete from public.departments where id = d_leaf; ok := false;
  exception when foreign_key_violation then ok := sqlerrm like 'Move its people%'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a department with sub-departments cannot be deleted (plain reason)';
  begin delete from public.departments where id = d_top; ok := false;
  exception when foreign_key_violation then ok := sqlerrm like 'Move or delete its sub-departments%'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an Admin cannot turn a membership into support access';
  begin update public.memberships set support_access = true where user_id = u_tech_a; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an Admin cannot remove themselves';
  begin delete from public.memberships where organization_id = org_a and user_id = u_admin_a; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Adding people by email
  res := public.org_add_member(org_a, ' LOOSE@test.invalid ', '{technician}', d_child);
  select count(*) into n from public.memberships
  where organization_id = org_a and user_id = u_loose and department_id = d_child;
  ok := res = 'added' and n = 1;
  label := 'an Admin adds an existing account by email, with a department';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  ok := public.org_add_member(org_a, 'loose@test.invalid', '{technician}') = 'already_member';
  label := 'adding someone already in the client says so';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  ok := public.org_add_member(org_a, 'nobody-yet@test.invalid', '{technician}') = 'no_account';
  label := 'an unknown email returns no_account (the app then sends the invite)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a support address cannot be added by a client';
  begin perform public.org_add_member(org_a, 'someone@assetnxg.app', '{admin}'); ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'Guest and HOD cannot be given as roles';
  begin perform public.org_add_member(org_a, 'x1@test.invalid', '{hod}'); ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a department of another client cannot be given';
  execute 'reset role';
  insert into public.departments (organization_id, name) values (org_b, 'B Admin office') returning id into d_b;
  execute 'set local role authenticated';
  begin update public.memberships set department_id = d_b where organization_id = org_a and user_id = u_head_a; ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Removing a head clears the head
  delete from public.memberships where organization_id = org_a and user_id = u_head_a;
  execute 'reset role';
  select count(*) into n from public.departments where id = d_child and head_user_id is null;
  ok := n = 1;
  label := 'removing a person from the client clears them as head';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.audit_log where table_name = 'departments' and record_id = d_top and action = 'insert' and actor_id = u_admin_a;
  ok := n = 1;
  label := 'department changes are in the audit log with who did them';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- ── Technician of A ─────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.departments where organization_id = org_a;
  ok := n = 3;
  label := 'staff can read their client''s departments';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff who are not Admin cannot add departments';
  begin insert into public.departments (organization_id, name) values (org_a, 'Sneaky'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff who are not Admin cannot add people';
  begin perform public.org_add_member(org_a, 'x2@test.invalid', '{technician}'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Admin of B, on B's address ──────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.departments where organization_id = org_a;
  ok := n = 0;
  label := 'another client''s Admin sees none of A''s departments';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.departments set name = 'Hacked' where id = d_top;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'another client''s Admin cannot rename A''s departments';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'another client''s Admin cannot add people to A';
  begin perform public.org_add_member(org_a, 'x3@test.invalid', '{admin}'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a department cannot sit under another client''s department';
  begin insert into public.departments (organization_id, name, parent_id) values (org_b, 'Under A', d_top); ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Keep one ordinary Admin ─────────────────────────────────────────────
  -- Admin A removes Admin Two (allowed: Admin A remains).
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';
  delete from public.memberships where organization_id = org_a and user_id = u_admin2_a;
  get diagnostics n = row_count;
  ok := n = 1;
  label := 'an Admin can remove another Admin while one remains';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- Support access (not an ordinary Admin) tries to remove the last one.
  perform set_config('request.jwt.claims', json_build_object('sub', u_support, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  label := 'the last ordinary Admin cannot be removed or demoted';
  begin delete from public.memberships where organization_id = org_a and user_id = u_admin_a; ok := false;
  exception when invalid_parameter_value then ok := true; end;
  if ok then
    begin update public.memberships set roles = '{technician}' where organization_id = org_a and user_id = u_admin_a; ok := false;
    exception when invalid_parameter_value then ok := true; end;
  end if;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Anonymous ───────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.headers', '', true);
  execute 'set local role anon';
  label := 'signed-out visitors cannot read departments';
  begin select count(*) into n from public.departments; ok := n = 0;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
