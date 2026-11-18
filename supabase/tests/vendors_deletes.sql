-- AssetNXG v2 · vendors delete checks (run in the Supabase SQL editor; the
-- MCP tool declines statements that delete). Leaves NOTHING behind.
-- "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  cat_e     uuid;
  cat_h     uuid;
  v1        uuid;
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

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';
  insert into public.categories (organization_id, name) values (org_a, 'Electrical') returning id into cat_e;
  insert into public.categories (organization_id, name) values (org_a, 'HVAC') returning id into cat_h;
  insert into public.vendors (organization_id, name, category_ids) values (org_a, 'Cool Air', array[cat_e, cat_h]) returning id into v1;

  delete from public.categories where id = cat_e;
  select category_ids into ids from public.vendors where id = v1;
  ok := ids = array[cat_h];
  label := 'a deleted category drops out of the vendors that supplied it';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';
  delete from public.vendors where id = v1;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'another client''s Admin cannot delete A''s vendors';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';
  delete from public.vendors where id = v1;
  get diagnostics n = row_count;
  ok := n = 1;
  label := 'an Admin can delete a vendor nothing uses yet';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  select count(*) into n from public.audit_log where table_name = 'vendors' and record_id = v1 and action = 'delete' and actor_id = u_admin;
  ok := n = 1;
  label := 'the delete is in the audit log with who made it';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
