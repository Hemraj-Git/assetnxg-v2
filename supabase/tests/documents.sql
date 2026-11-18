-- AssetNXG v2 · documents tests: DOC-YYYY- numbers (IST year), the file must
-- be uploaded into this client's folder (size and type from storage), links
-- to this client's assets and contracts only, link / unlink, locked columns,
-- who may read and write rows and files.
-- Deletes: see documents_deletes.sql (SQL editor).
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
  a1        uuid;
  a2        uuid;
  b1        uuid;
  con_a     uuid;
  con_b     uuid;
  doc       uuid;
  f1        text;
  f2        text;
  fb        text;
  v_code    text;
  v_type    text;
  v_size    bigint;
  v_by      uuid;
  ids       uuid[];
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

  with c as (insert into public.campuses (organization_id, name) values (org_a, 'Main') returning id),
       b as (insert into public.buildings (organization_id, campus_id, name) select org_a, id, 'Block A' from c returning id)
  insert into public.rooms (organization_id, building_id, name) select org_a, id, 'Room 1' from b returning id into room_a;
  with c as (insert into public.categories (organization_id, name) values (org_a, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name) select org_a, id, 'Split AC' from c returning id into sub_a;
  with c as (insert into public.campuses (organization_id, name) values (org_b, 'B') returning id),
       b as (insert into public.buildings (organization_id, campus_id, name) select org_b, id, 'B' from c returning id)
  insert into public.rooms (organization_id, building_id, name) select org_b, id, 'B' from b returning id into room_b;
  with c as (insert into public.categories (organization_id, name) values (org_b, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name) select org_b, id, 'B AC' from c returning id into sub_b;
  insert into public.vendors (organization_id, name) values (org_a, 'Cool Air') returning id into vend;
  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_a, 'AC 1', sub_a, room_a) returning id into a1;
  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_a, 'AC 2', sub_a, room_a) returning id into a2;
  insert into public.assets (organization_id, name, sub_category_id, room_id) values (org_b, 'B AC', sub_b, room_b) returning id into b1;
  insert into public.contracts (organization_id, kind, vendor_id, starts_on, ends_on, asset_ids)
  values (org_a, 'amc', vend, '2026-04-01', '2027-03-31', array[a1, a2]) returning id into con_a;
  insert into public.contracts (organization_id, kind, starts_on, ends_on, asset_ids)
  values (org_b, 'warranty', '2026-04-01', '2027-03-31', array[b1]) returning id into con_b;

  -- Files as storage would hold them after an upload.
  f1 := org_a || '/' || gen_random_uuid() || '.pdf';
  f2 := org_a || '/' || gen_random_uuid() || '.png';
  fb := org_b || '/' || gen_random_uuid() || '.pdf';
  insert into storage.objects (bucket_id, name, owner_id, metadata) values
    ('documents', f1, u_admin::text, '{"size": 482133, "mimetype": "application/pdf"}'),
    ('documents', f2, u_admin::text, '{"size": 90211, "mimetype": "image/png"}'),
    ('documents', fb, u_admin_b::text, '{"size": 1000, "mimetype": "application/pdf"}');

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  insert into public.documents (organization_id, title, doc_type, file_path, file_name, asset_ids, contract_ids)
  values (org_a, '  AMC agreement 2026  ', 'amc_contract', f1, 'amc-2026.pdf', array[a1, a2, a1], array[con_a])
  returning id, code, file_type, file_size, uploaded_by, asset_ids into doc, v_code, v_type, v_size, v_by, ids;
  ok := v_code = 'DOC-' || extract(year from private.org_today(org_a))::int || '-0001'
        and v_type = 'application/pdf' and v_size = 482133 and v_by = u_admin and cardinality(ids) = 2;
  label := 'DOC-<IST year>-0001; size and type come from storage; uploader recorded; repeats dropped';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select title into v_type from public.documents where id = doc;
  ok := v_type = 'AMC agreement 2026';
  label := 'title is trimmed';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a file that was never uploaded is refused';
  begin
    insert into public.documents (organization_id, title, file_path, file_name)
    values (org_a, 'Ghost', org_a || '/' || gen_random_uuid() || '.pdf', 'ghost.pdf');
    ok := false;
  exception when invalid_parameter_value then ok := sqlerrm like 'The file didn''t finish uploading%';
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a file in another client''s folder is refused';
  begin
    insert into public.documents (organization_id, title, file_path, file_name) values (org_a, 'Theirs', fb, 'b.pdf');
    ok := false;
  exception when invalid_parameter_value then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'one file can''t be two documents';
  begin
    insert into public.documents (organization_id, title, file_path, file_name) values (org_a, 'Again', f1, 'again.pdf');
    ok := false;
  exception when unique_violation then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'another client''s asset can''t be linked';
  begin
    update public.documents set asset_ids = array[a1, b1] where id = doc;
    ok := false;
  exception when foreign_key_violation then ok := sqlerrm = 'Choose assets of this organisation.';
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'another client''s contract can''t be linked';
  begin
    update public.documents set contract_ids = array[con_b] where id = doc;
    ok := false;
  exception when foreign_key_violation then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'the file and number can''t be changed by the app';
  begin
    update public.documents set file_path = f2 where id = doc;
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  begin
    update public.documents set code = 'DOC-1' where id = doc;
    ok := false;
  exception when insufficient_privilege then ok := ok;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.documents set title = 'AMC agreement 2026-27', doc_type = 'other' where id = doc;
  select code into v_code from public.documents where id = doc;
  ok := v_code like 'DOC-%-0001';
  label := 'renaming keeps the number';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- A second document with no links, then link and unlink from an asset.
  insert into public.documents (organization_id, title, doc_type, file_path, file_name)
  values (org_a, 'Nameplate photo', 'other', f2, 'plate.png') returning code into v_code;
  ok := v_code like 'DOC-%-0002';
  label := 'numbers continue (0002)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  n := public.link_documents(org_a, (select array_agg(id) from public.documents where organization_id = org_a), 'asset', a2, true);
  select count(*) into v_size from public.documents where asset_ids @> array[a2];
  ok := n = 2 and v_size = 2
        and (select cardinality(asset_ids) from public.documents where id = doc) = 2;
  label := 'link to an asset: both linked, no repeat where already linked';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  n := public.link_documents(org_a, array[doc], 'asset', a2, false);
  ok := n = 1 and (select asset_ids from public.documents where id = doc) = array[a1];
  label := 'unlink from an asset';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'linking another client''s asset through link_documents is refused';
  begin
    perform public.link_documents(org_a, array[doc], 'asset', b1, true);
    ok := false;
  exception when foreign_key_violation then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Files: Admins upload into their own client's folder only.
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('documents', org_a || '/' || gen_random_uuid() || '.pdf', u_admin::text, '{}');
  get diagnostics n = row_count;
  ok := n = 1;
  label := 'an Admin can upload into their client''s folder';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'an Admin can''t upload into another client''s folder';
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('documents', org_b || '/' || gen_random_uuid() || '.pdf', u_admin::text, '{}');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Technician: reads documents and files; changes nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  select count(*) into n from public.documents;
  select count(*) into v_size from storage.objects where bucket_id = 'documents' and name = f1;
  ok := n = 2 and v_size = 1;
  label := 'staff read the documents and their files';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.documents set title = 'Hacked' where id = doc;
  get diagnostics n = row_count;
  ok := n = 0 and public.link_documents(org_a, array[doc], 'asset', a2, true) = 0;
  label := 'staff can''t change documents or links';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff can''t add documents or upload files';
  begin
    insert into public.documents (organization_id, title, file_path, file_name) values (org_a, 'Mine', f2, 'x.png');
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('documents', org_a || '/' || gen_random_uuid() || '.pdf', u_tech::text, '{}');
    ok := false;
  exception when insufficient_privilege then ok := ok;
  end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Another client's Admin sees nothing of this one.
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  select count(*) into n from public.documents where organization_id = org_a;
  select count(*) into v_size from storage.objects where bucket_id = 'documents' and name = f1;
  ok := n = 0 and v_size = 0;
  label := 'another client sees none of the documents or files';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- Signed out.
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  label := 'signed out: no access';
  begin
    select count(*) into n from public.documents;
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  select count(*) into v_size from storage.objects where bucket_id = 'documents';
  ok := ok and v_size = 0;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';
  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
