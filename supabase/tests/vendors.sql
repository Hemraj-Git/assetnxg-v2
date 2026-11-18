-- AssetNXG v2 · vendors tests: VND- numbers, tidy contact details,
-- categories supplied (this client's only), who may read and write. (AMCs
-- are contracts on assets, tested with them.)
-- Deleting: see vendors_deletes.sql (SQL editor).
--
-- Leaves NOTHING behind. "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_tech    uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  cat_e     uuid;
  cat_h     uuid;
  cat_b     uuid;
  v1        uuid;
  v_code    text;
  r         record;
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
  insert into public.categories (organization_id, name) values (org_a, 'Electrical') returning id into cat_e;
  insert into public.categories (organization_id, name) values (org_a, 'HVAC') returning id into cat_h;
  insert into public.categories (organization_id, name) values (org_b, 'Electrical') returning id into cat_b;

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  insert into public.vendors (organization_id, name, contact_person, phone, email, category_ids)
  values (org_a, ' Cool Air Services ', ' Ravi ', ' +91 98765 43210 ', ' Sales@CoolAir.IN ', array[cat_h, cat_e, cat_h])
  returning id, code into v1, v_code;
  ok := v_code = 'VND-0001';
  label := 'vendor numbers come from the database (VND-0001)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select * into r from public.vendors where id = v1;
  ok := r.name = 'Cool Air Services' and r.contact_person = 'Ravi' and r.phone = '+91 98765 43210'
        and r.email = 'sales@coolair.in';
  label := 'details are trimmed and the email is lower-cased';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  ok := cardinality(r.category_ids) = 2 and r.category_ids @> array[cat_e, cat_h];
  label := 'categories supplied are kept once each';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.vendors (organization_id, name) values (org_a, 'Second vendor') returning code into v_code;
  ok := v_code = 'VND-0002';
  label := 'the next vendor is VND-0002';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'vendor names are unique per client, ignoring case';
  begin insert into public.vendors (organization_id, name) values (org_a, 'COOL AIR SERVICES'); ok := false;
  exception when unique_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a category of another client is refused';
  begin update public.vendors set category_ids = array[cat_b] where id = v1; ok := false;
  exception when foreign_key_violation then ok := sqlerrm = 'Choose categories from the list.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a made-up category is refused';
  begin update public.vendors set category_ids = array[gen_random_uuid()] where id = v1; ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a phone number with letters is refused';
  begin update public.vendors set phone = 'call me' where id = v1; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an email without @ is refused';
  begin update public.vendors set email = 'not-an-email' where id = v1; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a vendor number cannot be changed';
  begin update public.vendors set code = 'VND-9999' where id = v1; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.vendors set address = ' Plot 12, Patia ' where id = v1;
  select count(*) into n from public.audit_log where table_name = 'vendors' and record_id = v1 and actor_id = u_admin;
  ok := n = 2;
  label := 'vendor changes are in the audit log with who made them';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Technician of A ─────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.vendors where organization_id = org_a;
  ok := n = 2;
  label := 'staff can read their client''s vendors (to pick one on a job)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff who are not Admin cannot add vendors (yet: field-added vendors come with the field app)';
  begin insert into public.vendors (organization_id, name) values (org_a, 'Sneaky'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Admin of B ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.vendors where organization_id = org_a;
  ok := n = 0;
  label := 'another client''s Admin sees none of A''s vendors';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.vendors set name = 'Hacked' where id = v1;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'another client''s Admin cannot change A''s vendors';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.vendors (organization_id, name, category_ids) values (org_b, 'B vendor', array[cat_b]) returning code into v_code;
  ok := v_code = 'VND-0001';
  label := 'numbers restart for each client (B''s first vendor is VND-0001)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Anonymous ───────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.headers', '', true);
  execute 'set local role anon';
  label := 'signed-out visitors cannot read vendors';
  begin select count(*) into n from public.vendors; ok := n = 0;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
