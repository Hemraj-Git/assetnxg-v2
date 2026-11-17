-- AssetNXG v2 · notifications tests: server-only writes, own rows only,
-- one client per request, mark read / dismiss only, paused clients.
--
-- Like the other files here: leaves NOTHING behind (ends by raising the
-- report, which rolls everything back). "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin_a uuid := gen_random_uuid();
  u_tech_a  uuid := gen_random_uuid();
  u_multi   uuid := gen_random_uuid();  -- member of A and B
  u_none    uuid := gen_random_uuid();  -- member of nothing
  n_admin   uuid;
  n_tech    uuid;
  n_multi_a uuid;
  n_multi_b uuid;
  id_none   uuid;
  n         int;
  report    text := '';
  passed    int := 0;
  failed    int := 0;
  ok        boolean;
  label     text;
begin
  -- ── Setup ───────────────────────────────────────────────────────────────
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_admin_a, 'admin.a@test.invalid', '{"full_name":"Admin A"}'),
    (u_tech_a,  'tech.a@test.invalid',  '{"full_name":"Tech A"}'),
    (u_multi,   'multi@test.invalid',   '{"full_name":"Multi"}'),
    (u_none,    'none@test.invalid',    '{"full_name":"Nobody"}');
  insert into public.organizations (id, name, short_name, slug) values
    (org_a, 'Test Org A', 'TOA', 'zz-test-a'),
    (org_b, 'Test Org B', 'TOB', 'zz-test-b');
  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin_a, '{admin}'),
    (org_a, u_tech_a,  '{technician}'),
    (org_a, u_multi,   '{admin}'),
    (org_b, u_multi,   '{admin}');

  -- ── private.notify (as the server) ──────────────────────────────────────
  n_admin   := private.notify(org_a, u_admin_a, 'request_escalated', 'Request escalated', null, 'service_requests', gen_random_uuid(), 'SR-2026-0001');
  n_tech    := private.notify(org_a, u_tech_a,  'wo_assigned', 'Work assigned to you');
  n_multi_a := private.notify(org_a, u_multi,   'due_today', 'Due today in A');
  n_multi_b := private.notify(org_b, u_multi,   'due_today', 'Due today in B');
  id_none   := private.notify(org_a, u_none,    'due_today', 'Should not exist');

  ok := n_admin is not null and n_tech is not null and n_multi_a is not null and n_multi_b is not null;
  label := 'notify() writes a row for a member of the client';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  select count(*) into n from public.notifications where user_id = u_none;
  ok := id_none is null and n = 0;
  label := 'notify() writes nothing for someone outside the client';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- ── A signed-in person (technician of A) ────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.notifications where id in (n_admin, n_tech, n_multi_a, n_multi_b);
  ok := n = 1;
  label := 'a person sees only their own notifications';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a person cannot call notify()';
  begin perform private.notify(org_a, u_tech_a, 'due_today', 'Fake'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a person cannot insert a notification';
  begin
    insert into public.notifications (organization_id, user_id, type, title)
      values (org_a, u_tech_a, 'due_today', 'Fake');
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a person cannot delete a notification';
  begin delete from public.notifications where id = n_tech; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  label := 'a person cannot rewrite the title';
  begin update public.notifications set title = 'Changed' where id = n_tech; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.notifications set read_at = now() where id = n_tech;
  get diagnostics n = row_count;
  ok := n = 1;
  label := 'a person can mark their own notification read';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.notifications set dismissed_at = now() where id = n_tech;
  get diagnostics n = row_count;
  ok := n = 1;
  label := 'a person can dismiss their own notification';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.notifications set read_at = now(), dismissed_at = now() where id = n_admin;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'a person cannot mark someone else''s notification';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  execute 'reset role';
  select count(*) into n from public.notifications where id = n_admin and read_at is null and dismissed_at is null;
  ok := n = 1;
  label := '…and that notification is unchanged';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  -- ── A login in two clients: only the request's client ───────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_multi, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  select count(*) into n from public.notifications where id in (n_multi_a, n_multi_b);
  ok := n = 1 and exists (select 1 from public.notifications where id = n_multi_a);
  label := 'on client A''s address, a two-client login sees only A''s notifications';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.notifications set read_at = now() where id = n_multi_b;
  get diagnostics n = row_count;
  ok := n = 0;
  label := '…and cannot mark B''s notification from A''s address';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  perform set_config('request.headers', '', true);
  select count(*) into n from public.notifications where id in (n_multi_a, n_multi_b);
  ok := n = 2;
  label := 'without x-org-id (Realtime), both clients'' rows are theirs to receive';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Paused client ───────────────────────────────────────────────────────
  update public.organizations set status = 'suspended' where id = org_b;
  perform set_config('request.jwt.claims', json_build_object('sub', u_multi, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.notifications where id = n_multi_b;
  ok := n = 0;
  label := 'a paused client''s notifications are hidden';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  -- ── Signed out ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  label := 'signed out: no access to notifications';
  begin select count(*) into n from public.notifications; ok := false;
  exception when insufficient_privilege then ok := true; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
