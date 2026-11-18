-- AssetNXG v2 · spares tests: INV- numbers, specifications from the
-- sub-category, opening stock, stock movements (received, issued, counted;
-- never below zero; quantity only through movements), deploy as asset
-- (asset, stock -1, documents, warranty contract), links, who may read and
-- write, and the Spares module switch.
-- Deletes: see spares_deletes.sql (SQL editor).
--
-- Leaves NOTHING behind. "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_tech    uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  room_a    uuid;
  room_b    uuid;
  sub_a     uuid;
  sub_b     uuid;
  vend      uuid;
  sp        uuid;
  sp_b      uuid;
  doc       uuid;
  f1        text;
  v_code    text;
  v_asset   text;
  a_id      uuid;
  q         int;
  n         int;
  today     date;
  rec       record;
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
  insert into public.organization_modules (organization_id, module, enabled) values
    (org_a, 'spares', true), (org_b, 'spares', true);
  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin, '{admin}'), (org_a, u_tech, '{technician}'), (org_b, u_admin_b, '{admin}');
  today := private.org_today(org_a);

  with c as (insert into public.campuses (organization_id, name) values (org_a, 'Main') returning id),
       b as (insert into public.buildings (organization_id, campus_id, name) select org_a, id, 'Block A' from c returning id)
  insert into public.rooms (organization_id, building_id, name) select org_a, id, 'Store' from b returning id into room_a;
  with c as (insert into public.categories (organization_id, name) values (org_a, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name, asset_fields)
  select org_a, id, 'Split AC', '[{"key":"capacity","label":"Capacity","type":"number","unit":"ton","required":true}]'::jsonb from c
  returning id into sub_a;
  with c as (insert into public.campuses (organization_id, name) values (org_b, 'B') returning id),
       b as (insert into public.buildings (organization_id, campus_id, name) select org_b, id, 'B' from c returning id)
  insert into public.rooms (organization_id, building_id, name) select org_b, id, 'B' from b returning id into room_b;
  with c as (insert into public.categories (organization_id, name) values (org_b, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name) select org_b, id, 'B AC' from c returning id into sub_b;
  insert into public.vendors (organization_id, name) values (org_a, 'Cool Air') returning id into vend;
  insert into public.spares (organization_id, name, sub_category_id) values (org_b, 'B spare', sub_b) returning id into sp_b;

  f1 := org_a || '/' || gen_random_uuid() || '.pdf';
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('documents', f1, u_admin::text, '{"size": 1000, "mimetype": "application/pdf"}');

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  -- Adding a spare: number, specifications, opening stock.
  insert into public.spares (organization_id, name, sub_category_id, manufacturer, part_no, quantity, min_stock,
                             unit_cost, room_id, storage_note, vendor_id, spec_values)
  values (org_a, ' Split AC 1.5 T ', sub_a, ' Daikin ', 'FTKF50', 5, 2, 41000, room_a, 'Rack B, shelf 3', vend,
          '{"capacity": 1.5, "junk": "x"}')
  returning id, code, quantity into sp, v_code, q;
  select * into rec from public.stock_movements where spare_id = sp;
  ok := v_code = 'INV-0001' and q = 5 and rec.reason = 'opening' and rec.change = 5 and rec.balance_after = 5
        and rec.created_by = u_admin
        and (select spec_values from public.spares where id = sp) = '{"capacity": 1.5}'::jsonb
        and (select name from public.spares where id = sp) = 'Split AC 1.5 T';
  label := 'INV-0001 with its opening stock as the first movement; specs follow the sub-category';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a required specification must be filled';
  begin
    insert into public.spares (organization_id, name, sub_category_id) values (org_a, 'No specs', sub_a);
    ok := false;
  exception when invalid_parameter_value then ok := sqlerrm = 'Fill in “Capacity”.';
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a purchase date in the future is refused';
  begin
    update public.spares set purchase_date = today + 1 where id = sp;
    ok := false;
  exception when invalid_parameter_value then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'the quantity can''t be edited directly';
  begin
    update public.spares set quantity = 99 where id = sp;
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.stock_movements (organization_id, spare_id, change, reason, note)
  values (org_a, sp, 3, 'received', ' Invoice 4471 ') returning balance_after into q;
  ok := q = 8 and (select quantity from public.spares where id = sp) = 8;
  label := 'received adds to stock (8)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'stock can''t go below zero';
  begin
    insert into public.stock_movements (organization_id, spare_id, change, reason) values (org_a, sp, -10, 'issued');
    ok := false;
  exception when invalid_parameter_value then ok := sqlerrm = 'Only 8 in stock.';
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.stock_movements (organization_id, spare_id, change, reason, note)
  values (org_a, sp, -2, 'issued', 'Block B AC repair') returning balance_after into q;
  ok := q = 6;
  label := 'issued takes from stock (6)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.stock_movements (organization_id, spare_id, change, reason, counted)
  values (org_a, sp, 0, 'adjusted', 4) returning change, balance_after into n, q;
  ok := n = -2 and q = 4 and (select quantity from public.spares where id = sp) = 4;
  label := 'correcting the count works out the change (-2 → 4)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a count that matches is refused';
  begin
    insert into public.stock_movements (organization_id, spare_id, reason, counted) values (org_a, sp, 'adjusted', 4);
    ok := false;
  exception when invalid_parameter_value then ok := sqlerrm = 'The stock is already 4.';
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'opening, deployed and zero movements can''t be added by hand';
  ok := true;
  begin
    insert into public.stock_movements (organization_id, spare_id, change, reason) values (org_a, sp, 5, 'opening');
    ok := false;
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.stock_movements (organization_id, spare_id, change, reason) values (org_a, sp, -1, 'deployed');
    ok := false;
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.stock_movements (organization_id, spare_id, change, reason) values (org_a, sp, 0, 'received');
    ok := false;
  exception when invalid_parameter_value then null;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'movements can''t be edited';
  begin
    update public.stock_movements set change = 100 where spare_id = sp;
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Documents link to spares (this client's only).
  insert into public.documents (organization_id, title, doc_type, file_path, file_name, spare_ids)
  values (org_a, 'User guide', 'user_guide', f1, 'guide.pdf', array[sp]) returning id into doc;
  label := 'another client''s spare can''t be linked to a document';
  begin
    perform public.link_documents(org_a, array[doc], 'spare', sp_b, true);
    ok := false;
  exception when foreign_key_violation then ok := sqlerrm = 'Choose spares of this organisation.';
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Deploy as asset.
  update public.spares set purchase_date = today - 10, warranty_till = today + 365 where id = sp;
  label := 'deploying into another client''s room is refused';
  begin
    perform public.deploy_spare(org_a, sp, room_b);
    ok := false;
  exception when invalid_parameter_value then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an installation date before the purchase is refused';
  begin
    perform public.deploy_spare(org_a, sp, room_a, null, null, today - 20);
    ok := false;
  exception when invalid_parameter_value then ok := sqlerrm like 'The installation date can''t be before the purchase date%';
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  v_asset := public.deploy_spare(org_a, sp, room_a, 'AC Room 204', 'SN-9');
  select id into a_id from public.assets where code = v_asset and organization_id = org_a;
  select * into rec from public.assets where id = a_id;
  ok := v_asset = 'AST-0001'
        and rec.name = 'AC Room 204' and rec.serial_no = 'SN-9' and rec.manufacturer = 'Daikin'
        and rec.price = 41000 and rec.purchased_from_id = vend and rec.installation_date = today
        and rec.spec_values = '{"capacity": 1.5}'::jsonb
        and (select quantity from public.spares where id = sp) = 3;
  label := 'deploy makes AST-0001 with the spare''s details and specs, and takes 1 from stock';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select * into rec from public.stock_movements where spare_id = sp and reason = 'deployed';
  ok := rec.asset_id = a_id and rec.change = -1 and rec.balance_after = 3
        and (select asset_ids from public.documents where id = doc) = array[a_id]
        and (select spare_ids from public.documents where id = doc) = array[sp];
  label := 'the movement names the asset; the asset gets the spare''s documents (kept on the spare too)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.contracts c
  where c.organization_id = org_a and c.kind = 'warranty' and c.asset_ids = array[a_id]
    and c.starts_on = today - 10 and c.ends_on = today + 365;
  ok := n = 1;
  label := 'a warranty still running becomes a warranty contract on the asset';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  insert into public.stock_movements (organization_id, spare_id, reason, counted) values (org_a, sp, 'adjusted', 0);
  label := 'at 0 the spare stays, and deploying is refused';
  begin
    perform public.deploy_spare(org_a, sp, room_a);
    ok := false;
  exception when invalid_parameter_value then ok := sqlerrm = 'None of INV-0001 left in stock to deploy.';
  end;
  ok := ok and exists (select 1 from public.spares where id = sp and quantity = 0);
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Technician: reads; changes nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  select count(*) into n from public.stock_movements where spare_id = sp;
  ok := (select count(*) from public.spares where organization_id = org_a) = 1 and n = 6;
  label := 'staff read spares and their stock history';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff can''t change stock, edit spares or deploy';
  update public.spares set name = 'Hacked' where id = sp;
  get diagnostics n = row_count;
  ok := n = 0;
  begin
    insert into public.stock_movements (organization_id, spare_id, change, reason) values (org_a, sp, 1, 'received');
    ok := false;
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.deploy_spare(org_a, sp, room_a);
    ok := false;
  exception when invalid_parameter_value then null;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Another client sees nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  select count(*) into n from public.spares where organization_id = org_a;
  select count(*) into q from public.stock_movements where organization_id = org_a;
  ok := n = 0 and q = 0;
  label := 'another client sees none of the spares or movements';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Spares module switched off: hidden, and nothing can be added.
  execute 'reset role';
  update public.organization_modules set enabled = false where organization_id = org_a and module = 'spares';
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.spares;
  label := 'with the Spares module off, spares are hidden and can''t be added';
  begin
    insert into public.spares (organization_id, name, sub_category_id, spec_values)
    values (org_a, 'Off', sub_a, '{"capacity": 1}');
    ok := false;
  exception when insufficient_privilege then ok := n = 0;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Signed out.
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  label := 'signed out: no access';
  begin
    select count(*) into n from public.spares;
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';
  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
