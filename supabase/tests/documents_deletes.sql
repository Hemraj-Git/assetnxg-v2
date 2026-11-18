-- AssetNXG v2 · documents: deletes (run in the Supabase SQL editor; the MCP
-- tool declines statements that delete). Leaves NOTHING behind.
-- "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_tech    uuid := gen_random_uuid();
  room_a    uuid;
  sub_a     uuid;
  vend      uuid;
  a1        uuid;
  a2        uuid;
  con_a     uuid;
  doc       uuid;
  f1        text;
  n         int;
  report    text := '';
  passed    int := 0;
  failed    int := 0;
  ok        boolean;
  label     text;
begin
  insert into auth.users (id, email) values (u_admin, 'admin@test.invalid'), (u_tech, 'tech@test.invalid');
  insert into public.organizations (id, name, short_name, slug) values (org_a, 'Test Org A', 'TOA', 'zz-test-a');
  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin, '{admin}'), (org_a, u_tech, '{technician}');

  with c as (insert into public.campuses (organization_id, name) values (org_a, 'Main') returning id),
       b as (insert into public.buildings (organization_id, campus_id, name) select org_a, id, 'Block A' from c returning id)
  insert into public.rooms (organization_id, building_id, name) select org_a, id, 'Room 1' from b returning id into room_a;
  with c as (insert into public.categories (organization_id, name) values (org_a, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name) select org_a, id, 'Split AC' from c returning id into sub_a;
  insert into public.vendors (organization_id, name) values (org_a, 'Cool Air') returning id into vend;
  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_a, 'AC 1', sub_a, room_a) returning id into a1;
  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_a, 'AC 2', sub_a, room_a) returning id into a2;
  insert into public.contracts (organization_id, kind, vendor_id, starts_on, ends_on, asset_ids)
  values (org_a, 'amc', vend, '2026-04-01', '2027-03-31', array[a1, a2]) returning id into con_a;

  f1 := org_a || '/' || gen_random_uuid() || '.pdf';
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('documents', f1, u_admin::text, '{"size": 1000, "mimetype": "application/pdf"}');

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  insert into public.documents (organization_id, title, doc_type, file_path, file_name, asset_ids, contract_ids)
  values (org_a, 'AMC agreement', 'amc_contract', f1, 'amc.pdf', array[a1, a2], array[con_a])
  returning id into doc;

  -- An asset deleted by mistake drops out of the document's links.
  delete from public.assets where id = a2;
  ok := (select asset_ids from public.documents where id = doc) = array[a1];
  label := 'deleting an asset removes it from its documents';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  delete from public.contracts where id = con_a;
  ok := (select cardinality(contract_ids) from public.documents where id = doc) = 0;
  label := 'deleting a contract removes it from its documents';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Staff can't delete documents.
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  delete from public.documents where id = doc;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'staff can''t delete documents';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- An Admin deletes the record; the file stays in storage (no deletes
  -- through the API), so support can recover it.
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  delete from public.documents where id = doc;
  get diagnostics n = row_count;
  ok := n = 1;
  -- Storage refuses direct deletes outright, or RLS matches no row.
  begin
    delete from storage.objects where bucket_id = 'documents' and name = f1;
    get diagnostics n = row_count;
  exception when others then n := 0;
  end;
  ok := ok and n = 0;
  execute 'reset role';
  ok := ok and exists (select 1 from storage.objects where bucket_id = 'documents' and name = f1);
  label := 'an Admin deletes the record; the file itself can''t be deleted through the API';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
