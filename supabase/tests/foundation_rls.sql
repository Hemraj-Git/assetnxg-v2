-- AssetNXG v2 · foundation tests: tenant isolation, roles, numbering, audit.
--
-- Runs against the live dev project and leaves NOTHING behind: the block always
-- ends by raising an exception whose message is the report, which rolls back
-- every row it made. Read the report from the error text.
--   "RESULT: n passed, 0 failed" = all good.
--
-- Run it in the Supabase SQL editor or through the MCP execute_sql tool.

do $test$
declare
  org_a      uuid := gen_random_uuid();
  org_b      uuid := gen_random_uuid();
  u_admin_a  uuid := gen_random_uuid();
  u_tech_a   uuid := gen_random_uuid();
  u_guest_a  uuid := gen_random_uuid();
  u_admin_b  uuid := gen_random_uuid();
  u_support  uuid := gen_random_uuid();
  u_meta     uuid := gen_random_uuid();
  n          int;
  t          text;
  ist_year   text := extract(year from (now() at time zone 'Asia/Kolkata'))::text;
  report     text := '';
  passed     int := 0;
  failed     int := 0;
  ok         boolean;
  label      text;
begin
  -- ── Setup (as the migration owner) ──────────────────────────────────────
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_admin_a, 'admin.a@test.invalid',   '{"full_name":"Admin A"}'),
    (u_tech_a,  'tech.a@test.invalid',    '{"full_name":"Tech A"}'),
    (u_guest_a, 'guest.a@test.invalid',   '{"full_name":"Guest A"}'),
    (u_admin_b, 'admin.b@test.invalid',   '{"full_name":"Admin B"}'),
    (u_support, 'support.t@assetnxg.app', '{"full_name":"Support"}'),
    -- tries to make itself Admin through sign-up metadata
    (u_meta,    'sneaky@test.invalid',    '{"full_name":"Sneaky","role":"admin","roles":["admin"]}');

  insert into public.organizations (id, name, short_name, slug) values
    (org_a, 'Test Org A', 'TOA', 'zz-test-a'),
    (org_b, 'Test Org B', 'TOB', 'zz-test-b');

  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin_a, '{admin}'),
    (org_a, u_tech_a,  '{technician}'),
    (org_a, u_guest_a, '{guest}'),
    (org_b, u_admin_b, '{admin}'),
    (org_a, u_support, '{admin}'),
    (org_b, u_support, '{admin}');

  -- 1. Profiles are made for new users; support flag from the email domain.
  select count(*) into n from public.profiles
    where id in (u_admin_a, u_tech_a, u_guest_a, u_admin_b, u_support, u_meta);
  ok := n = 6; label := 'profile created for every new auth user (got ' || n || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.profiles where id = u_support and is_support;
  ok := n = 1; label := '@assetnxg.app profile is flagged as support';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- 2. Sign-up metadata never grants a role.
  select count(*) into n from public.memberships where user_id = u_meta;
  ok := n = 0; label := 'sign-up metadata "role: admin" gives no membership';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- ── As Admin of org A ───────────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.organizations where id in (org_a, org_b);
  ok := n = 1; label := 'Admin A sees only org A (saw ' || n || ' of the 2 test orgs)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.memberships where organization_id in (org_a, org_b);
  ok := n = 3; label := 'Admin A sees org A memberships without support (saw ' || n || ', want 3)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.profiles
    where id in (u_admin_a, u_tech_a, u_guest_a, u_admin_b, u_support, u_meta);
  ok := n = 3; label := 'Admin A sees A''s people, not B''s, not support (saw ' || n || ', want 3)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'Admin A cannot add a member to org B';
  begin
    insert into public.memberships (organization_id, user_id, roles)
      values (org_b, u_tech_a, '{technician}');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'Admin A cannot change their own roles';
  begin
    update public.memberships set roles = '{admin,accounts}'
      where user_id = u_admin_a and organization_id = org_a;
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.memberships set roles = '{technician,store_incharge}'
    where user_id = u_tech_a and organization_id = org_a;
  get diagnostics n = row_count;
  ok := n = 1; label := 'Admin A can change Tech A''s roles';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.audit_log
    where organization_id = org_a and table_name = 'memberships'
      and action = 'update' and actor_id = u_admin_a;
  ok := n = 1; label := 'role change is in the audit log with Admin A as actor';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.memberships set roles = '{admin}'
    where user_id = u_admin_b and organization_id = org_b;
  get diagnostics n = row_count;
  ok := n = 0; label := 'Admin A cannot change roles in org B (0 rows)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'users cannot change their profile email';
  begin
    update public.profiles set email = 'x@test.invalid' where id = u_admin_a;
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.profiles set phone = '+91 90000 00000' where id = u_admin_a;
  get diagnostics n = row_count;
  ok := n = 1; label := 'users can change their own phone';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'signed-in users cannot call the number generator directly';
  begin
    perform private.make_number(org_a, 'zz_test', 'T', true);
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'signed-in users cannot write counters';
  begin
    insert into public.counters (organization_id, kind, year, last_value)
      values (org_a, 'zz_test', 0, 99);
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';

  -- ── As Technician of org A ──────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_tech_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  update public.memberships set roles = '{admin}'
    where user_id = u_tech_a and organization_id = org_a;
  get diagnostics n = row_count;
  ok := n = 0; label := 'Technician cannot promote themselves (0 rows)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.audit_log where organization_id = org_a;
  ok := n = 0; label := 'Technician cannot read the audit log';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';

  -- ── As Guest of org A ───────────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_guest_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.profiles
    where id in (u_admin_a, u_tech_a, u_guest_a, u_admin_b, u_support, u_meta);
  ok := n = 1; label := 'Guest sees only their own profile (saw ' || n || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.memberships where organization_id in (org_a, org_b);
  ok := n = 1; label := 'Guest sees only their own membership (saw ' || n || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';

  -- ── As support login ────────────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_support, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.organizations where id in (org_a, org_b);
  ok := n = 2; label := 'support login sees both of its organisations';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.profiles
    where id in (u_admin_a, u_tech_a, u_guest_a, u_admin_b, u_support, u_meta);
  ok := n = 5; label := 'support login sees everyone in its orgs incl. itself (saw ' || n || ', want 5)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';

  -- ── Not signed in (anon) ────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';

  select count(*) into n from public.org_brand('zz-test-a');
  ok := n = 1; label := 'anon can look up a brand by slug (sign-in page)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'anon cannot read organizations';
  begin
    select count(*) into n from public.organizations;
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';

  -- ── Numbering (as the server) ───────────────────────────────────────────
  t := private.make_number(org_a, 'zz_test', 'T', true);
  ok := t = 'T-' || ist_year || '-0001'; label := 'first yearly number in org A = ' || t;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  t := private.make_number(org_a, 'zz_test', 'T', true);
  ok := t = 'T-' || ist_year || '-0002'; label := 'second yearly number in org A = ' || t;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  t := private.make_number(org_b, 'zz_test', 'T', true);
  ok := t = 'T-' || ist_year || '-0001'; label := 'org B has its own sequence = ' || t;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  t := private.make_number(org_a, 'zz_plain', 'AST', false);
  ok := t = 'AST-0001'; label := 'non-yearly number = ' || t;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.counters set last_value = 9999
    where organization_id = org_a and kind = 'zz_plain';
  t := private.make_number(org_a, 'zz_plain', 'AST', false);
  ok := t = 'AST-10000'; label := 'numbers grow past 9999 without truncation = ' || t;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  ok := private.org_today(org_a) = (now() at time zone 'Asia/Kolkata')::date;
  label := 'org "today" is the IST date (' || private.org_today(org_a) || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- ── Report and roll everything back ─────────────────────────────────────
  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
