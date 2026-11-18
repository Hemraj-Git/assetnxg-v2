-- AssetNXG v2 · categories tests: codes from names (and clashes), codes
-- never change, sub-categories stay in their category, the asset-field
-- check, unique names, who may read and write. Delete guards: see
-- categories_deletes.sql (SQL editor).
--
-- Leaves NOTHING behind (ends by raising the report, which rolls everything
-- back). "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_tech    uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  cat_elec  uuid;
  cat_mech  uuid;
  sub_light uuid;
  v_code    text;
  n         int;
  good      jsonb := '[{"key":"cap","label":"Capacity","type":"number","unit":"kVA","required":true},
                      {"key":"made","label":"Made on","type":"date","required":false},
                      {"key":"note","label":"Notes","type":"text","unit":null,"required":false}]';
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

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  -- ── Category codes ──────────────────────────────────────────────────────
  insert into public.categories (organization_id, name) values (org_a, ' Electrical ') returning id, code into cat_elec, v_code;
  ok := v_code = 'ELEC';
  label := 'a category code is the name''s first 4 letters (Electrical → ELEC)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.categories (organization_id, name) values (org_a, 'Electronics') returning code into v_code;
  ok := v_code = 'ELE2';
  label := 'a clash gets the next free code (Electronics → ELE2)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.categories (organization_id, name) values (org_a, 'AC') returning code into v_code;
  ok := v_code = 'ACXX';
  label := 'short names are padded (AC → ACXX)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.categories (organization_id, name) values (org_a, '—') returning code into v_code;
  ok := v_code = 'GENR';
  label := 'a name with no letters gets GENR';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.categories (organization_id, name) values (org_a, 'Mechanical') returning id into cat_mech;

  label := 'category names are unique per client, ignoring case';
  begin insert into public.categories (organization_id, name) values (org_a, 'ELECTRICAL'); ok := false;
  exception when unique_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.categories set name = 'Electrical systems' where id = cat_elec;
  select c.code into v_code from public.categories c where c.id = cat_elec;
  ok := v_code = 'ELEC';
  label := 'renaming keeps the code';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a code cannot be set or changed by the app';
  begin update public.categories set code = 'HACK' where id = cat_elec; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- ── Sub-category codes ──────────────────────────────────────────────────
  insert into public.sub_categories (organization_id, category_id, name, sla_priority, asset_fields)
  values (org_a, cat_elec, 'Lighting', 'medium', good) returning id, code into sub_light, v_code;
  ok := v_code = 'ELEC-LIGH';
  label := 'a sub-category code is category + 4 letters (ELEC-LIGH)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.sub_categories (organization_id, category_id, name) values (org_a, cat_elec, 'Lights outdoor') returning code into v_code;
  ok := v_code = 'ELEC-LIG2';
  label := 'a sub-category clash gets the next free code (ELEC-LIG2)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.sub_categories (organization_id, category_id, name) values (org_a, cat_elec, 'UPS') returning code into v_code;
  ok := v_code = 'ELEC-UPS0';
  label := 'short sub-category names are padded with 0 (ELEC-UPS0)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.sub_categories (organization_id, category_id, name) values (org_a, cat_mech, 'Lighting') returning code into v_code;
  ok := v_code = 'MECH-LIGH';
  label := 'the same sub-category name is fine in another category';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'sub-category names are unique within a category, ignoring case';
  begin insert into public.sub_categories (organization_id, category_id, name) values (org_a, cat_elec, 'LIGHTING'); ok := false;
  exception when unique_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a sub-category cannot move to another category';
  begin update public.sub_categories set category_id = cat_mech where id = sub_light; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.sub_categories set name = 'Lamps', sla_priority = 'high' where id = sub_light;
  select count(*) into n from public.sub_categories where id = sub_light and code = 'ELEC-LIGH' and sla_priority = 'high';
  ok := n = 1;
  label := 'renaming a sub-category keeps its code; priority can change';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- ── Asset fields check ──────────────────────────────────────────────────
  select count(*) into n from public.sub_categories where id = sub_light and jsonb_array_length(asset_fields) = 3;
  ok := n = 1;
  label := 'well-formed asset fields are saved';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an unknown field type is refused';
  begin update public.sub_categories set asset_fields = '[{"key":"a","label":"A","type":"colour","required":false}]' where id = sub_light; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'two fields with the same key are refused';
  begin update public.sub_categories set asset_fields = '[{"key":"a","label":"A","type":"text","required":false},{"key":"a","label":"B","type":"text","required":false}]' where id = sub_light; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'two fields with the same label (ignoring case) are refused';
  begin update public.sub_categories set asset_fields = '[{"key":"a","label":"Size","type":"text","required":false},{"key":"b","label":" size","type":"number","required":false}]' where id = sub_light; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'extra properties and missing "required" are refused';
  begin update public.sub_categories set asset_fields = '[{"key":"a","label":"A","type":"text","required":false,"script":"x"}]' where id = sub_light; ok := false;
  exception when check_violation then ok := true; end;
  if ok then
    begin update public.sub_categories set asset_fields = '[{"key":"a","label":"A","type":"text"}]' where id = sub_light; ok := false;
    exception when check_violation then ok := true; end;
  end if;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'more than 30 fields are refused';
  begin
    update public.sub_categories
    set asset_fields = (select jsonb_agg(jsonb_build_object('key', 'k' || i, 'label', 'Field ' || i, 'type', 'text', 'required', false))
                        from generate_series(1, 31) i)
    where id = sub_light;
    ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'asset fields must be a list';
  begin update public.sub_categories set asset_fields = '{"key":"a"}' where id = sub_light; ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.audit_log where table_name = 'sub_categories' and record_id = sub_light and actor_id = u_admin;
  ok := n = 2;
  label := 'changes are in the audit log with who made them';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Technician of A ─────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.sub_categories where organization_id = org_a;
  ok := n = 4;
  label := 'staff can read their client''s categories';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff who are not Admin cannot add categories';
  begin insert into public.categories (organization_id, name) values (org_a, 'Sneaky'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Admin of B ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';

  select (select count(*) from public.categories where organization_id = org_a)
       + (select count(*) from public.sub_categories where organization_id = org_a) into n;
  ok := n = 0;
  label := 'another client''s Admin sees none of A''s categories';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.categories (organization_id, name) values (org_b, 'Electrical') returning code into v_code;
  ok := v_code = 'ELEC';
  label := 'codes are per client (B''s Electrical is ELEC too)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a sub-category cannot be put in another client''s category';
  begin insert into public.sub_categories (organization_id, category_id, name) values (org_b, cat_elec, 'Sneaky'); ok := false;
  exception when foreign_key_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Anonymous ───────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.headers', '', true);
  execute 'set local role anon';
  label := 'signed-out visitors cannot read categories';
  begin select count(*) into n from public.categories; ok := n = 0;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
