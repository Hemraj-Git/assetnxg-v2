-- AssetNXG v2 · checklist templates: deletes (run in the Supabase SQL editor;
-- the MCP tool declines statements that delete). Leaves NOTHING behind.
-- "RESULT: n passed, 0 failed" = good.

do $test$
declare
  org_a     uuid := gen_random_uuid();
  org_b     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid();
  t_used    uuid;
  t_free    uuid;
  sub_a     uuid;
  n         int;
  item      jsonb := '[{"key":"k1","text":"Clean filters","response":"checkbox","mandatory":true,"photo_required":false}]';
  report    text := '';
  passed    int := 0;
  failed    int := 0;
  ok        boolean;
  label     text;
begin
  insert into auth.users (id, email) values (u_admin, 'admin@test.invalid'), (u_admin_b, 'adminb@test.invalid');
  insert into public.organizations (id, name, short_name, slug) values
    (org_a, 'Test Org A', 'TOA', 'zz-test-a'), (org_b, 'Test Org B', 'TOB', 'zz-test-b');
  insert into public.organization_modules (organization_id, module, enabled) values
    (org_a, 'maintenance', true), (org_b, 'maintenance', true);
  insert into public.memberships (organization_id, user_id, roles) values
    (org_a, u_admin, '{admin}'), (org_b, u_admin_b, '{admin}');
  insert into public.checklist_templates (organization_id, kind, title, repeats, items) values (org_a, 'pm', 'Used', 'monthly', item) returning id into t_used;
  insert into public.checklist_templates (organization_id, kind, title, repeats, items) values (org_a, 'pm', 'Free', 'monthly', item) returning id into t_free;
  with c as (insert into public.categories (organization_id, name) values (org_a, 'HVAC') returning id)
  insert into public.sub_categories (organization_id, category_id, name, template_ids) select org_a, id, 'Split AC', array[t_used] from c returning id into sub_a;

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_b)::text, true);
  execute 'set local role authenticated';
  delete from public.checklist_templates where id = t_free;
  get diagnostics n = row_count;
  ok := n = 0;
  label := 'another client''s Admin cannot delete A''s templates';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-org-id', org_a)::text, true);
  execute 'set local role authenticated';

  label := 'a template a sub-category uses cannot be deleted (plain reason)';
  begin delete from public.checklist_templates where id = t_used; ok := false;
  exception when foreign_key_violation then ok := sqlerrm = 'Used by 1 sub-category (Split AC). Remove it there first.'; end;
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  delete from public.checklist_templates where id = t_free;
  get diagnostics n = row_count;
  ok := n = 1;
  label := 'an unused template can be deleted';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;

  update public.sub_categories set template_ids = '{}' where id = sub_a;
  delete from public.checklist_templates where id = t_used;
  get diagnostics n = row_count;
  ok := n = 1;
  label := 'once removed from the sub-category, it can be deleted';
  report := report || case when ok then 'PASS ' else 'FAIL ' end || label || E'\n';
  if ok then passed := passed + 1; else failed := failed + 1; end if;
  execute 'reset role';

  raise exception E'\n%RESULT: % passed, % failed', report, passed, failed;
end;
$test$;
