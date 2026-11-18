-- AssetNXG v2 · approval hierarchy tests: who approves a requisition at the
-- Head of Department step (own head, up the tree, Director at the top),
-- stand-ins (active dates, never the requester), and stand-in rules.
--
-- Like the other files here: leaves NOTHING behind (ends by raising the
-- report, which rolls everything back). "RESULT: n passed, 0 failed" = good.
-- No DELETE statements, so it can run through the Supabase MCP tool.

do $test$
declare
  org_a    uuid := gen_random_uuid();
  org_b    uuid := gen_random_uuid();
  u_admin  uuid := gen_random_uuid();
  u_h1     uuid := gen_random_uuid();  -- heads Academics
  u_h2     uuid := gen_random_uuid();  -- heads Marine Engineering
  u_req    uuid := gen_random_uuid();  -- in Workshop (no head)
  u_peer   uuid := gen_random_uuid();  -- in Marine Engineering
  u_nodept uuid := gen_random_uuid();  -- no department
  u_stand  uuid := gen_random_uuid();  -- stand-in
  u_guest  uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  d_acad   uuid;
  d_marine uuid;
  d_work   uuid;
  today    date;
  r        record;
  n        int;
  report   text := '';
  passed   int := 0;
  failed   int := 0;
  ok       boolean;
  label    text;
begin
  -- ── Setup (as the server) ───────────────────────────────────────────────
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_admin,  'admin@test.invalid',  '{"full_name":"Admin"}'),
    (u_h1,     'h1@test.invalid',     '{"full_name":"Asha Head"}'),
    (u_h2,     'h2@test.invalid',     '{"full_name":"Bala Head"}'),
    (u_req,    'req@test.invalid',    '{"full_name":"Ravi Requester"}'),
    (u_peer,   'peer@test.invalid',   '{"full_name":"Pooja Peer"}'),
    (u_nodept, 'nodept@test.invalid', '{"full_name":"Nina Nodept"}'),
    (u_stand,  'stand@test.invalid',  '{"full_name":"Sunil Standin"}'),
    (u_guest,  'guest@test.invalid',  '{"full_name":"Guest"}'),
    (u_admin_b,'adminb@test.invalid', '{"full_name":"Admin B"}');
  insert into public.organizations (id, name, short_name, slug) values
    (org_a, 'Test Org A', 'TOA', 'zz-test-a'),
    (org_b, 'Test Org B', 'TOB', 'zz-test-b');
  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin,  '{admin}'),
    (org_a, u_h1,     '{faculty}'),
    (org_a, u_h2,     '{faculty}'),
    (org_a, u_req,    '{technician}'),
    (org_a, u_peer,   '{technician}'),
    (org_a, u_nodept, '{technician}'),
    (org_a, u_stand,  '{faculty}'),
    (org_a, u_guest,  '{guest}'),
    (org_b, u_admin_b,'{admin}');

  insert into public.departments (organization_id, name, head_user_id) values (org_a, 'Academics', u_h1) returning id into d_acad;
  insert into public.departments (organization_id, name, parent_id, head_user_id) values (org_a, 'Marine Engineering', d_acad, u_h2) returning id into d_marine;
  insert into public.departments (organization_id, name, parent_id) values (org_a, 'Workshop', d_marine) returning id into d_work;

  update public.memberships set department_id = d_acad   where organization_id = org_a and user_id = u_h1;
  update public.memberships set department_id = d_marine where organization_id = org_a and user_id in (u_h2, u_peer);
  update public.memberships set department_id = d_work   where organization_id = org_a and user_id = u_req;

  today := private.org_today(org_a);

  -- ── Who approves ────────────────────────────────────────────────────────
  select * into r from private.resolve_department_approver(org_a, d_marine, u_peer);
  ok := r.approver_user_id = u_h2 and r.note = 'Bala Head, head of Marine Engineering';
  label := 'a requisition goes to the head of the requester''s department';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select * into r from private.resolve_department_approver(org_a, d_work, u_req);
  ok := r.approver_user_id = u_h2 and r.department_id = d_marine
        and r.note = 'Bala Head, head of Marine Engineering, because Workshop has no head';
  label := 'a department without a head sends it up to the department above';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select * into r from private.resolve_department_approver(org_a, d_marine, u_h2);
  ok := r.approver_user_id = u_h1
        and r.note = 'Asha Head, head of Academics, because the requester heads Marine Engineering';
  label := 'a head''s own requisition goes up to the department above';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select * into r from private.resolve_department_approver(org_a, d_acad, u_h1);
  ok := r.approver_user_id is null and r.approver_role = 'director' and r.note like 'The Director / Principal, because the requester heads Academics%';
  label := 'past the top of the tree it goes to the Director / Principal';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select * into r from private.resolve_department_approver(org_a, null, u_nodept);
  ok := r.approver_role = 'director' and r.note = 'The Director / Principal, because the requester has no department';
  label := 'someone with no department goes to the Director / Principal';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- ── Stand-ins (Admin sets them) ─────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  insert into public.approval_delegations (organization_id, from_user_id, to_user_id, starts_on, ends_on, reason)
  values (org_a, u_h2, u_stand, today - 1, today + 5, ' On leave ');

  label := 'overlapping stand-ins for the same person are refused';
  begin
    insert into public.approval_delegations (organization_id, from_user_id, to_user_id, starts_on, ends_on)
    values (org_a, u_h2, u_peer, today + 5, today + 9);
    ok := false;
  exception when invalid_parameter_value then ok := sqlerrm like 'There is already a stand-in from%'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a stand-in that has already ended is refused';
  begin
    insert into public.approval_delegations (organization_id, from_user_id, to_user_id, starts_on, ends_on)
    values (org_a, u_h1, u_stand, today - 10, today - 1);
    ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a guest cannot be a stand-in';
  begin
    insert into public.approval_delegations (organization_id, from_user_id, to_user_id, starts_on, ends_on)
    values (org_a, u_h1, u_guest, today, today + 1);
    ok := false;
  exception when invalid_parameter_value then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'nobody stands in for themselves';
  begin
    insert into public.approval_delegations (organization_id, from_user_id, to_user_id, starts_on, ends_on)
    values (org_a, u_h1, u_h1, today, today + 1);
    ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a stand-in is at most a year long';
  begin
    insert into public.approval_delegations (organization_id, from_user_id, to_user_id, starts_on, ends_on)
    values (org_a, u_h1, u_stand, today, today + 400);
    ok := false;
  exception when check_violation then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.approval_delegations
  where from_user_id = u_h2 and created_by = u_admin and reason = 'On leave';
  ok := n = 1;
  label := 'who set a stand-in is recorded (and the reason is trimmed)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.org_approver_map(org_a);
  ok := n = 7;
  label := 'an Admin sees where every staff member''s requisitions go (not guests)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  select * into r from private.resolve_department_approver(org_a, d_work, u_req);
  ok := r.approver_user_id = u_stand and r.on_behalf_of = u_h2
        and r.note = format('Sunil Standin, standing in for Bala Head (head of Marine Engineering) until %s, because Workshop has no head', to_char(today + 5, 'DD-MM-YYYY'));
  label := 'while a stand-in is active, it goes to the stand-in';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select * into r from private.resolve_department_approver(org_a, null, u_stand);
  ok := r.approver_role = 'director';
  label := '(control) the stand-in''s own requisition is unaffected';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- A stand-in never approves their own requisition: it goes to the head.
  update public.memberships set department_id = d_marine where organization_id = org_a and user_id = u_stand;
  select * into r from private.resolve_department_approver(org_a, d_marine, u_stand);
  ok := r.approver_user_id = u_h2 and r.on_behalf_of is null;
  label := 'a stand-in never approves their own requisition';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- A head on leave raising their own requisition: not their stand-in, up.
  select * into r from private.resolve_department_approver(org_a, d_marine, u_h2);
  ok := r.approver_user_id = u_h1 and r.on_behalf_of is null
        and r.note = 'Asha Head, head of Academics, because the requester heads Marine Engineering';
  label := 'a head''s stand-in never approves the head''s own requisition (it goes up)';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- A stand-in that starts later is not used yet.
  insert into public.approval_delegations (organization_id, from_user_id, to_user_id, starts_on, ends_on)
  values (org_a, u_h1, u_stand, today + 3, today + 4);
  select * into r from private.resolve_department_approver(org_a, d_marine, u_h2);
  ok := r.approver_user_id = u_h1;
  label := 'a stand-in that starts later is not used yet';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- A head who is no longer staff (now only a guest) is passed over.
  update public.memberships set roles = '{guest}' where organization_id = org_a and user_id = u_h2;
  select * into r from private.resolve_department_approver(org_a, d_marine, u_peer);
  ok := r.approver_user_id = u_h1 and r.note like '%because Marine Engineering has no head';
  label := 'a head who is no longer staff is passed over';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  update public.memberships set roles = '{faculty}' where organization_id = org_a and user_id = u_h2;

  -- ── A staff member (not Admin) ──────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_h1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.approval_delegations (organization_id, from_user_id, to_user_id, starts_on, ends_on)
  values (org_a, u_h1, u_peer, today + 10, today + 12);
  get diagnostics n = row_count;
  ok := n = 1;
  label := 'an approver can set their own stand-in';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff cannot set a stand-in for someone else';
  begin
    insert into public.approval_delegations (organization_id, from_user_id, to_user_id, starts_on, ends_on)
    values (org_a, u_h2, u_h1, today + 20, today + 21);
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.approval_delegations where from_user_id = u_h2;
  ok := n = 0;
  label := 'staff see only stand-ins they gave or hold';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff cannot see the approver map';
  begin perform public.org_approver_map(org_a); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'staff cannot call the resolver directly';
  begin perform private.resolve_department_approver(org_a, d_marine, u_peer); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a stand-in cannot be changed (remove and add again)';
  begin update public.approval_delegations set ends_on = today + 30 where from_user_id = u_h1; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Another client's Admin ──────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.approval_delegations where organization_id = org_a;
  ok := n = 0;
  label := 'another client''s Admin sees none of A''s stand-ins';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'another client''s Admin cannot see A''s approver map';
  begin perform public.org_approver_map(org_a); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'another client''s Admin cannot add stand-ins in A';
  begin
    insert into public.approval_delegations (organization_id, from_user_id, to_user_id, starts_on, ends_on)
    values (org_a, u_h1, u_stand, today + 30, today + 31);
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Anonymous ───────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.headers', '', true);
  execute 'set local role anon';
  label := 'signed-out visitors cannot read stand-ins';
  begin select count(*) into n from public.approval_delegations; ok := n = 0;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
