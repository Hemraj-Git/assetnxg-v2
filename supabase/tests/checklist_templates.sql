-- AssetNXG v2 · checklist templates tests: item rules, versions, kinds and
-- modules (PM needs Maintenance, Inspection needs Inspections), links from
-- sub-categories, who may read and write. Deletes: see
-- checklist_templates_deletes.sql (SQL editor).
--
-- Leaves NOTHING behind. "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();   -- maintenance + inspections
  org_m     uuid := gen_random_uuid();   -- maintenance only
  u_admin   uuid := gen_random_uuid();
  u_tech    uuid := gen_random_uuid();
  u_admin_m uuid := gen_random_uuid();
  t_pm      uuid;
  t_in      uuid;
  t_m       uuid;
  sub_a     uuid;
  v_ver     int;
  n         int;
  item      jsonb := '{"key":"k1","text":"Clean filters","instructions":null,"response":"checkbox","unit":null,"mandatory":true,"photo_required":true}';
  items2    jsonb := '[{"key":"k1","text":"Clean filters","response":"checkbox","mandatory":true,"photo_required":true},
                       {"key":"k2","text":"Supply air temperature","response":"numeric","unit":"°C","mandatory":true,"photo_required":false}]';
  report    text := '';
  passed    int := 0;
  failed    int := 0;
  ok        boolean;
  label     text;
begin
  insert into auth.users (id, email) values
    (u_admin, 'admin@test.invalid'), (u_tech, 'tech@test.invalid'), (u_admin_m, 'adminm@test.invalid');
  insert into public.organizations (id, name, short_name, slug) values
    (org_a, 'Test Org A', 'TOA', 'zz-test-a'), (org_m, 'Test Org M', 'TOM', 'zz-test-m');
  insert into public.organization_modules (organization_id, module, enabled) values
    (org_a, 'maintenance', true), (org_a, 'inspections', true), (org_m, 'maintenance', true);
  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin, '{admin}'), (org_a, u_tech, '{technician}'), (org_m, u_admin_m, '{admin}');
  with c as (insert into public.categories (organization_id, name) values (org_a, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name) select org_a, id, 'Split AC' from c returning id into sub_a;

  -- ── Admin of A ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  insert into public.checklist_templates (organization_id, kind, title, repeats, items)
  values (org_a, 'pm', ' Split AC monthly service ', 'monthly', jsonb_build_array(item)) returning id, version into t_pm, v_ver;
  select count(*) into n from public.checklist_templates where id = t_pm and title = 'Split AC monthly service' and created_by = u_admin;
  ok := n = 1 and v_ver = 1;
  label := 'a PM template is saved (trimmed, version 1, who made it)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.checklist_templates (organization_id, kind, title, repeats, items)
  values (org_a, 'inspection', 'Split AC monthly service', 'annually', jsonb_build_array(item)) returning id into t_in;
  ok := t_in is not null;
  label := 'the same title is fine for the other kind';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'titles are unique per kind, ignoring case';
  begin insert into public.checklist_templates (organization_id, kind, title, repeats, items) values (org_a, 'pm', 'SPLIT AC MONTHLY SERVICE', 'weekly', jsonb_build_array(item)); ok := false;
  exception when unique_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a template needs at least one item';
  begin insert into public.checklist_templates (organization_id, kind, title, repeats, items) values (org_a, 'pm', 'Empty', 'weekly', '[]'); ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an unknown answer type is refused';
  begin update public.checklist_templates set items = jsonb_build_array(item || '{"response":"stars"}') where id = t_pm; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an item without "photo_required" is refused';
  begin update public.checklist_templates set items = jsonb_build_array(item - 'photo_required') where id = t_pm; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'two items with the same key are refused';
  begin update public.checklist_templates set items = jsonb_build_array(item, item) where id = t_pm; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'more than 100 items are refused';
  begin
    update public.checklist_templates
    set items = (select jsonb_agg(item || jsonb_build_object('key', 'k' || i)) from generate_series(1, 101) i)
    where id = t_pm;
    ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.checklist_templates set title = 'Split AC monthly service (1–2 ton)' where id = t_pm;
  update public.checklist_templates set items = items2 where id = t_pm;
  select version into v_ver from public.checklist_templates where id = t_pm;
  ok := v_ver = 2;
  label := 'the version goes up when the items change, not when the title does';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a template''s kind cannot be changed';
  begin update public.checklist_templates set kind = 'inspection' where id = t_pm; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.sub_categories set template_ids = array[t_pm, t_in, t_pm] where id = sub_a;
  select count(*) into n from public.sub_categories where id = sub_a and cardinality(template_ids) = 2;
  ok := n = 1;
  label := 'a sub-category lists its PM and inspection templates (once each)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.audit_log where table_name = 'checklist_templates' and record_id = t_pm and actor_id = u_admin;
  ok := n = 3;
  label := 'template changes are in the audit log with who made them';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Technician of A ─────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.checklist_templates where organization_id = org_a;
  ok := n = 2;
  label := 'staff can read their client''s templates';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff who are not Admin cannot add templates';
  begin insert into public.checklist_templates (organization_id, kind, title, repeats, items) values (org_a, 'pm', 'Sneaky', 'weekly', jsonb_build_array(item)); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Admin of M (Maintenance only, no Inspections) ───────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_m, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_m)::text, true);
  execute 'set local role authenticated';

  insert into public.checklist_templates (organization_id, kind, title, repeats, items)
  values (org_m, 'pm', 'Generator monthly', 'monthly', jsonb_build_array(item)) returning id into t_m;
  ok := t_m is not null;
  label := 'with Maintenance on, PM templates can be added';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'without the Inspections module, inspection templates are refused';
  begin insert into public.checklist_templates (organization_id, kind, title, repeats, items) values (org_m, 'inspection', 'Fire check', 'monthly', jsonb_build_array(item)); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.checklist_templates where organization_id = org_a;
  ok := n = 0;
  label := 'another client''s Admin sees none of A''s templates';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- A sub-category can't list another client's template (as the server).
  label := 'a sub-category cannot list another client''s template';
  begin update public.sub_categories set template_ids = array[t_m] where id = sub_a; ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Inspections switched off for A: its inspection templates disappear.
  update public.organization_modules set enabled = false where organization_id = org_a and module = 'inspections';
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.checklist_templates where organization_id = org_a;
  ok := n = 1;
  label := 'switching Inspections off hides inspection templates (PM ones stay)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Anonymous ───────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.headers', '', true);
  execute 'set local role anon';
  label := 'signed-out visitors cannot read templates';
  begin select count(*) into n from public.checklist_templates; ok := n = 0;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
