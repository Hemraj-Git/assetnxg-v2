-- AssetNXG v2 · platform tests: platform admins, console functions, modules,
-- support access, suspension, and one-client-per-request scoping (x-org-id).
--
-- Like foundation_rls.sql: leaves NOTHING behind (ends by raising the report,
-- which rolls everything back). "RESULT: n passed, 0 failed" = all good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  org_c     uuid;
  u_pa      uuid := gen_random_uuid();  -- platform admin, no memberships
  u_admin_a uuid := gen_random_uuid();  -- client Admin of A
  u_tech_a  uuid := gen_random_uuid();
  u_multi   uuid := gen_random_uuid();  -- Admin in A and B (e.g. a consultant)
  n         int;
  t         text;
  b         boolean;
  report    text := '';
  passed    int := 0;
  failed    int := 0;
  ok        boolean;
  label     text;
begin
  -- ── Setup ───────────────────────────────────────────────────────────────
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_pa,      'owner.pa@test.invalid',  '{"full_name":"Platform Owner"}'),
    (u_admin_a, 'admin.a@test.invalid',   '{"full_name":"Admin A"}'),
    (u_tech_a,  'tech.a@test.invalid',    '{"full_name":"Tech A"}'),
    (u_multi,   'multi@test.invalid',     '{"full_name":"Multi"}');
  insert into public.platform_admins (user_id) values (u_pa);
  insert into public.organizations (id, name, short_name, slug) values
    (org_a, 'Test Org A', 'TOA', 'zz-test-a'),
    (org_b, 'Test Org B', 'TOB', 'zz-test-b');
  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin_a, '{admin}'),
    (org_a, u_tech_a,  '{technician}'),
    (org_a, u_multi,   '{admin}'),
    (org_b, u_multi,   '{admin}');
  insert into public.organization_modules (organization_id, module, enabled) values
    (org_a, 'maintenance', true), (org_a, 'procurement', false),
    (org_b, 'housekeeping', true);

  -- ── A client Admin cannot use the console ───────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  label := 'client Admin cannot list clients (platform_organizations)';
  begin perform * from public.platform_organizations(); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'client Admin cannot create a client';
  begin perform public.platform_create_organization('X', 'X', 'zz-x'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'client Admin cannot switch modules';
  begin perform public.platform_set_modules(org_a, '{procurement}'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'client Admin cannot write module rows directly';
  begin insert into public.organization_modules (organization_id, module) values (org_a, 'procurement'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'client Admin cannot add a support-access membership';
  begin
    insert into public.memberships (organization_id, user_id, roles, support_access)
      values (org_a, u_pa, '{admin}', true);
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'client Admin cannot turn a membership into support access';
  begin
    update public.memberships set support_access = true where user_id = u_tech_a;
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'client Admin cannot make themselves a platform admin';
  begin insert into public.platform_admins (user_id) values (u_admin_a); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.organization_modules where organization_id in (org_a, org_b);
  ok := n = 2; label := 'client Admin sees only their client''s module rows (saw ' || n || ', want 2)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';

  -- ── Platform admin: manages clients, sees no client data ─────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_pa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.platform_organizations() where id in (org_a, org_b);
  ok := n = 2; label := 'platform admin lists clients';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select member_count into n from public.platform_organizations(org_a);
  ok := n = 3; label := 'client list shows people counts (A: ' || n || ', want 3)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.memberships where organization_id in (org_a, org_b);
  ok := n = 0; label := 'platform admin reads no client memberships (saw ' || n || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.profiles where id in (u_admin_a, u_tech_a, u_multi);
  ok := n = 0; label := 'platform admin reads no client people (saw ' || n || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.audit_log where organization_id in (org_a, org_b);
  ok := n = 0; label := 'platform admin reads no client audit log';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  org_c := public.platform_create_organization('Test Org C', 'TOC', 'ZZ-Test-C', 'en-IN', 'inr', 'Asia/Kolkata', '{maintenance,procurement}');
  select slug into t from public.platform_organizations(org_c);
  ok := t = 'zz-test-c'; label := 'platform admin creates a client (address lower-cased: ' || t || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select array_to_string(modules, ',') into t from public.platform_organizations(org_c);
  ok := t = 'maintenance,procurement'; label := 'new client starts with the chosen modules (' || t || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'reserved address "console" is refused';
  begin perform public.platform_create_organization('X', 'X', 'console'); ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a taken address is refused with a plain message';
  begin perform public.platform_create_organization('X', 'X', 'zz-test-a'); ok := false;
  exception when unique_violation then ok := sqlerrm like '%already taken%'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an unknown time zone is refused';
  begin perform public.platform_create_organization('X', 'X', 'zz-x', 'en-IN', 'INR', 'Mars/Olympus'); ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  perform public.platform_set_modules(org_c, '{housekeeping,inspections}');
  select array_to_string(modules, ',') into t from public.platform_organizations(org_c);
  ok := t = 'housekeeping,inspections'; label := 'set modules switches exactly those on (' || t || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a logo URL outside the branding bucket is refused';
  begin perform public.platform_set_logo(org_c, 'wide', 'https://evil.example/logo.png'); ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  t := public.platform_add_member(org_c, 'ADMIN.A@test.invalid', '{admin}');
  ok := t = 'added'; label := 'platform admin adds an existing account as Admin (' || t || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  t := public.platform_add_member(org_c, 'nobody@test.invalid', '{admin}');
  ok := t = 'no_account'; label := 'adding an email with no account says so (' || t || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Support access
  perform public.platform_grant_support(org_a);
  select count(*) into n from public.memberships where organization_id = org_a;
  ok := n = 4; label := 'with support access the platform admin sees client A (memberships: ' || n || ')';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.memberships where organization_id = org_b;
  ok := n = 0; label := 'support access to A gives nothing in B';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'support access cannot be used to change your own roles directly';
  begin
    update public.memberships set roles = '{admin,accounts}' where user_id = u_pa and organization_id = org_a;
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';

  -- The client's Admin: support login hidden from people, visible in the audit log
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.memberships where organization_id = org_a and user_id = u_pa;
  ok := n = 0; label := 'support access is hidden from the client''s member list';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.profiles where id = u_pa;
  ok := n = 0; label := 'support person is hidden from the client''s people';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.audit_log
    where organization_id = org_a and table_name = 'memberships' and action = 'insert'
      and actor_id = u_pa and (new_data ->> 'support_access')::boolean;
  ok := n = 1; label := 'the client''s Admin can see the support access in the audit log';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_pa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.platform_revoke_support(org_a);
  select count(*) into n from public.memberships where organization_id = org_a;
  ok := n = 0; label := 'after revoking support access the platform admin sees nothing in A';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Suspension
  perform public.platform_set_status(org_a, 'suspended');
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.organizations where id = org_a;
  ok := n = 0; label := 'members of a suspended client cannot read it';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.profiles where id = u_tech_a;
  ok := n = 0; label := 'members of a suspended client cannot read its people';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.organizations where id = org_c;
  ok := n = 1; label := 'their other, active client still works';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  execute 'set local role anon';
  select status into t from public.org_lookup('zz-test-a');
  ok := t = 'suspended'; label := 'sign-in lookup reports the client as suspended';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'anon cannot call console functions';
  begin perform * from public.platform_organizations(); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  update public.organizations set status = 'active' where id = org_a;

  -- ── One client per request (x-org-id) ───────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_multi, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.organizations where id in (org_a, org_b);
  ok := n = 2; label := 'without x-org-id a two-client login sees both (server paths unchanged)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  select count(*) into n from public.organizations where id in (org_a, org_b);
  ok := n = 1; label := 'with x-org-id = A the same login sees only A';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.memberships where organization_id = org_b and user_id <> u_multi;
  ok := n = 0; label := '…and none of B''s people, even without filtering by client';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.organization_modules where organization_id = org_b;
  ok := n = 0; label := '…and none of B''s module settings';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  perform set_config('request.headers', json_build_object('x-org-id', org_c)::text, true);
  select count(*) into n from public.organizations where id in (org_a, org_b, org_c);
  ok := n = 0; label := 'x-org-id of a client you don''t belong to gives nothing (never widens)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  perform set_config('request.headers', '{"x-org-id":"not-a-uuid"}', true);
  select count(*) into n from public.organizations where id in (org_a, org_b);
  ok := n = 0; label := 'a malformed x-org-id gives nothing (deny, not "no filter")';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  perform set_config('request.headers', '', true);
  execute 'reset role';

  -- ── Module check helper ─────────────────────────────────────────────────
  ok := private.org_has_module(org_a, 'maintenance') and not private.org_has_module(org_a, 'procurement')
        and not private.org_has_module(org_a, 'reservations');
  label := 'org_has_module: on, switched off, and never set';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
