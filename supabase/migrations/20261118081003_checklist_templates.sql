-- AssetNXG v2 · checklist templates (PM and inspection) and their links to
-- sub-categories (Phase 2)
-- Rules: 02 "Checklist templates"; 03 §2 (templates in use can't be
-- deleted; jobs copy the items, inspections keep template_version). Template
-- archive is not approved (05), so in-use templates just can't be deleted.
--
-- - Kind: PM (Maintenance module) or Inspection (Inspections module). Rows
--   of a module that is off are invisible and can't be written.
-- - Repeats: weekly, monthly, quarterly, half-yearly, annually.
-- - Items: up to 100, each {key, text, instructions, response, unit,
--   mandatory, photo_required}; response checkbox | pass_fail | yes_no |
--   numeric | text. Checked by the database.
-- - version goes up when the items or the interval change.
-- - Sub-categories list their templates (template_ids); a template linked to
--   a sub-category can't be deleted. Schedules and jobs add their own guard.

create type public.checklist_kind as enum ('pm', 'inspection');
create type public.repeat_interval as enum ('weekly', 'monthly', 'quarterly', 'half_yearly', 'annually');

-- ─────────────────────────────────────────────────────────────────────────
-- Items check (CASE decides list / object before anything that needs one)
-- ─────────────────────────────────────────────────────────────────────────

create function private.valid_checklist_items(f jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when f is null or jsonb_typeof(f) <> 'array' then false
    when jsonb_array_length(f) > 100 then false
    else
      not exists (
        select 1
        from jsonb_array_elements(f) e
        where case
          when jsonb_typeof(e) <> 'object' then true
          else not coalesce(
            not exists (
              select 1 from jsonb_object_keys(e) k
              where k not in ('key', 'text', 'instructions', 'response', 'unit', 'mandatory', 'photo_required')
            )
            and coalesce(e ->> 'key', '') ~ '^[a-z0-9_-]{1,40}$'
            and length(trim(coalesce(e ->> 'text', ''))) between 1 and 200
            and (
              e -> 'instructions' is null
              or jsonb_typeof(e -> 'instructions') = 'null'
              or (jsonb_typeof(e -> 'instructions') = 'string' and length(e ->> 'instructions') <= 500)
            )
            and coalesce(e ->> 'response', '') in ('checkbox', 'pass_fail', 'yes_no', 'numeric', 'text')
            and (
              e -> 'unit' is null
              or jsonb_typeof(e -> 'unit') = 'null'
              or (jsonb_typeof(e -> 'unit') = 'string' and length(e ->> 'unit') <= 20)
            )
            and coalesce(jsonb_typeof(e -> 'mandatory') = 'boolean', false)
            and coalesce(jsonb_typeof(e -> 'photo_required') = 'boolean', false),
            false
          )
        end
      )
      and (select count(distinct e ->> 'key') from jsonb_array_elements(f) e) = jsonb_array_length(f)
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Templates
-- ─────────────────────────────────────────────────────────────────────────

create table public.checklist_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  kind             public.checklist_kind not null,
  title            extensions.citext not null check (length(trim(title::text)) between 1 and 120),
  description      text check (description is null or length(description) <= 300),
  repeats          public.repeat_interval not null,
  items            jsonb not null default '[]'::jsonb check (private.valid_checklist_items(items)),
  version          integer not null default 1,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, kind, title)
);

create index checklist_templates_created_by_idx on public.checklist_templates (created_by);

create function private.template_module(k public.checklist_kind)
returns public.app_module
language sql
immutable
set search_path = ''
as $$
  select case when k = 'pm' then 'maintenance'::public.app_module else 'inspections'::public.app_module end;
$$;

create function private.template_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.title := trim(new.title::text);
  new.description := nullif(trim(new.description), '');
  if jsonb_array_length(new.items) = 0 then
    raise exception 'Add at least one checklist item.' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_by := auth.uid();
  else
    new.organization_id := old.organization_id;
    -- A PM template stays a PM template (jobs and schedules depend on it).
    new.kind := old.kind;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.version := old.version
      + case when new.items is distinct from old.items or new.repeats is distinct from old.repeats then 1 else 0 end;
  end if;
  return new;
end;
$$;

create trigger checklist_templates_before_write before insert or update on public.checklist_templates
  for each row execute function private.template_before_write();

create trigger checklist_templates_updated_at before update on public.checklist_templates
  for each row execute function private.set_updated_at();

create trigger checklist_templates_audit after insert or update or delete on public.checklist_templates
  for each row execute function private.audit_row();

-- ─────────────────────────────────────────────────────────────────────────
-- Sub-categories list their PM and inspection templates
-- ─────────────────────────────────────────────────────────────────────────

alter table public.sub_categories
  add column template_ids uuid[] not null default '{}' check (cardinality(template_ids) <= 50);

create index sub_categories_template_ids_idx on public.sub_categories using gin (template_ids);

create function private.sub_category_templates_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.template_ids := coalesce(
    (select array_agg(distinct t order by t) from unnest(new.template_ids) t where t is not null),
    '{}'
  );
  if exists (
    select 1 from unnest(new.template_ids) t
    where not exists (
      select 1 from public.checklist_templates c where c.id = t and c.organization_id = new.organization_id
    )
  ) then
    raise exception 'Choose checklist templates from the list.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger sub_categories_templates_check before insert or update of template_ids on public.sub_categories
  for each row execute function private.sub_category_templates_check();

grant insert (template_ids) on public.sub_categories to authenticated;
grant update (template_ids) on public.sub_categories to authenticated;

-- A template in use can't be deleted (plain reason).
create function private.template_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  names text;
  n integer;
begin
  if not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;
  select count(*), string_agg(s.name::text, ', ' order by s.name) into n, names
  from public.sub_categories s
  where s.organization_id = old.organization_id and s.template_ids @> array[old.id];
  if n > 0 then
    raise exception 'Used by % (%). Remove it there first.',
      case when n = 1 then '1 sub-category' else n || ' sub-categories' end, names
      using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger checklist_templates_before_delete before delete on public.checklist_templates
  for each row execute function private.template_before_delete();

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security: staff read, Admins write; only with the module on
-- ─────────────────────────────────────────────────────────────────────────

alter table public.checklist_templates enable row level security;

create policy "staff read templates" on public.checklist_templates for select to authenticated
  using (
    organization_id in (select private.my_staff_org_ids())
    and private.org_has_module(organization_id, private.template_module(kind))
  );
create policy "admins add templates" on public.checklist_templates for insert to authenticated
  with check (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    and private.org_has_module(organization_id, private.template_module(kind))
  );
create policy "admins change templates" on public.checklist_templates for update to authenticated
  using (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    and private.org_has_module(organization_id, private.template_module(kind))
  )
  with check (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    and private.org_has_module(organization_id, private.template_module(kind))
  );
create policy "admins remove templates" on public.checklist_templates for delete to authenticated
  using (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    and private.org_has_module(organization_id, private.template_module(kind))
  );

revoke all on public.checklist_templates from anon;
revoke insert, update on public.checklist_templates from authenticated;
grant insert (organization_id, kind, title, description, repeats, items) on public.checklist_templates to authenticated;
grant update (title, description, repeats, items) on public.checklist_templates to authenticated;

revoke execute on function
  private.template_before_write(),
  private.sub_category_templates_check(),
  private.template_before_delete()
from public, anon, authenticated;
-- Used inside policies and a check constraint.
revoke execute on function private.valid_checklist_items(jsonb), private.template_module(public.checklist_kind) from public, anon;
grant execute on function private.valid_checklist_items(jsonb), private.template_module(public.checklist_kind) to authenticated;
