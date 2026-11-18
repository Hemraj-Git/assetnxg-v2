-- AssetNXG v2 · spares: deletes (run in the Supabase SQL editor; the MCP
-- tool declines statements that delete). Leaves NOTHING behind.
-- "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  room_a    uuid;
  room_2    uuid;
  sub_a     uuid;
  vend      uuid;
  sp_new    uuid;
  sp_used   uuid;
  doc       uuid;
  f1        text;
  v_asset   text;
  n         int;
  report    text := '';
  passed    int := 0;
  failed    int := 0;
  ok        boolean;
  label     text;
begin
  insert into auth.users (id, email) values (u_admin, 'admin@test.invalid');
  insert into public.organizations (id, name, short_name, slug) values (org_a, 'Test Org A', 'TOA', 'zz-test-a');
  insert into public.organization_modules (organization_id, module, enabled) values (org_a, 'spares', true);
  insert into public.memberships (organization_id, user_id, roles) values (org_a, u_admin, '{admin}');

  with c as (insert into public.campuses (organization_id, name) values (org_a, 'Main') returning id),
       b as (insert into public.buildings (organization_id, campus_id, name) select org_a, id, 'Block A' from c returning id)
  insert into public.rooms (organization_id, building_id, name) select org_a, id, 'Store' from b returning id into room_a;
  insert into public.rooms (organization_id, building_id, name)
  select org_a, building_id, 'Room 2' from public.rooms where id = room_a returning id into room_2;
  with c as (insert into public.categories (organization_id, name) values (org_a, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name) select org_a, id, 'Split AC' from c returning id into sub_a;
  insert into public.vendors (organization_id, name) values (org_a, 'Cool Air') returning id into vend;

  f1 := org_a || '/' || gen_random_uuid() || '.pdf';
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('documents', f1, u_admin::text, '{"size": 1000, "mimetype": "application/pdf"}');

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  insert into public.spares (organization_id, name, sub_category_id, quantity, room_id, vendor_id)
  values (org_a, 'Added by mistake', sub_a, 4, room_a, vend) returning id into sp_new;
  insert into public.spares (organization_id, name, sub_category_id, quantity)
  values (org_a, 'Used spare', sub_a, 3) returning id into sp_used;
  insert into public.documents (organization_id, title, file_path, file_name, spare_ids)
  values (org_a, 'Guide', f1, 'guide.pdf', array[sp_new]) returning id into doc;

  label := 'a room, sub-category or vendor used by spares can''t be deleted (plain reasons)';
  ok := true;
  begin delete from public.rooms where id = room_a; ok := false;
  exception when foreign_key_violation then ok := ok and sqlerrm = '1 spare is stored in this room. Move them to another room first.'; end;
  begin delete from public.sub_categories where id = sub_a; ok := false;
  exception when foreign_key_violation then ok := ok and sqlerrm = '2 spares use this sub-category. Change their sub-category first.'; end;
  begin delete from public.vendors where id = vend; ok := false;
  exception when foreign_key_violation then ok := ok and sqlerrm = 'This vendor supplies 1 spare on record, so it can''t be deleted.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Only an opening movement: deleting is allowed; its links go too.
  delete from public.spares where id = sp_new;
  get diagnostics n = row_count;
  ok := n = 1
        and not exists (select 1 from public.stock_movements where spare_id = sp_new)
        and (select cardinality(spare_ids) from public.documents where id = doc) = 0;
  label := 'a spare with no stock history beyond its opening can be deleted (links removed)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- With history it stays.
  v_asset := public.deploy_spare(org_a, sp_used, room_2);
  label := 'a spare with stock history can''t be deleted';
  begin
    delete from public.spares where id = sp_used;
    ok := false;
  exception when foreign_key_violation then
    ok := sqlerrm = 'This spare has stock history (1 change), so it stays on record. Set its stock to 0 instead.';
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- The deployed asset deleted by mistake: the movement stays, unlinked.
  delete from public.contracts where organization_id = org_a;
  delete from public.assets where code = v_asset and organization_id = org_a;
  select count(*) into n from public.stock_movements where spare_id = sp_used and reason = 'deployed' and asset_id is null;
  ok := n = 1;
  label := 'deleting a deployed asset keeps the stock movement (asset link cleared)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';
  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
