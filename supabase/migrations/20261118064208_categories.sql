-- AssetNXG v2 · categories and sub-categories (Phase 2)
-- Rules: 02 "Taxonomy"; 03 §1 (codes from the name, unique, never changed),
-- §2 (SLA priority: asset, else sub-category, else the requester chooses).
--
-- - Category code: the name's first 4 letters/digits (Electrical → ELEC).
--   If taken, the 4th character becomes 2–9, then A–Z (ELE2 …).
-- - Sub-category code: category code + "-" + its own 4 (ELEC-LIGH), with the
--   same rule for clashes. A sub-category stays in its category (the code
--   carries the category), and codes never change, even after a rename.
-- - Asset fields: the extra details assets of a sub-category record
--   ("Capacity", Number, "kVA"). Checked by the database: up to 30 fields,
--   each {key, label, type text|number|date, unit, required}; keys and
--   labels unique. Order = position in the list. PM and inspection templates
--   link here when checklist templates are built.

create type public.sla_priority as enum ('critical', 'high', 'medium', 'low');

-- ─────────────────────────────────────────────────────────────────────────
-- Codes
-- ─────────────────────────────────────────────────────────────────────────

-- The first 4 letters/digits of a name, upper case, padded; '' when none.
create function private.code_part(p_name text, p_pad text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when regexp_replace(upper(coalesce(p_name, '')), '[^A-Z0-9]', '', 'g') = '' then ''
    else rpad(left(regexp_replace(upper(p_name), '[^A-Z0-9]', '', 'g'), 4), 4, p_pad)
  end;
$$;

-- p_prefix || base, or the first free variant (last character 2–9, A–Z).
create function private.free_code(p_org uuid, p_table text, p_prefix text, p_base text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  c text;
  taken boolean;
begin
  foreach c in array array['', '2','3','4','5','6','7','8','9',
                           'A','B','C','D','E','F','G','H','I','J','K','L','M',
                           'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'] loop
    candidate := p_prefix || case when c = '' then p_base else left(p_base, 3) || c end;
    if p_table = 'categories' then
      select exists (select 1 from public.categories x where x.organization_id = p_org and x.code = candidate) into taken;
    else
      select exists (select 1 from public.sub_categories x where x.organization_id = p_org and x.code = candidate) into taken;
    end if;
    if not taken then
      return candidate;
    end if;
  end loop;
  raise exception 'Too many names start the same way. Choose a different name.' using errcode = '22023';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Asset fields check
-- ─────────────────────────────────────────────────────────────────────────

create function private.valid_asset_fields(f jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(f) = 'array'
    and jsonb_array_length(f) <= 30
    and not exists (
      select 1
      from jsonb_array_elements(f) e
      where not (
        jsonb_typeof(e) = 'object'
        and not exists (
          select 1 from jsonb_object_keys(e) k
          where k not in ('key', 'label', 'type', 'unit', 'required')
        )
        and coalesce(e ->> 'key', '') ~ '^[a-z0-9_-]{1,40}$'
        and length(trim(coalesce(e ->> 'label', ''))) between 1 and 60
        and coalesce(e ->> 'type', '') in ('text', 'number', 'date')
        and (
          e -> 'unit' is null
          or jsonb_typeof(e -> 'unit') = 'null'
          or (jsonb_typeof(e -> 'unit') = 'string' and length(e ->> 'unit') <= 20)
        )
        and jsonb_typeof(e -> 'required') = 'boolean'
      )
    )
    and (select count(distinct e ->> 'key') from jsonb_array_elements(f) e) = jsonb_array_length(f)
    and (select count(distinct lower(trim(e ->> 'label'))) from jsonb_array_elements(f) e) = jsonb_array_length(f);
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  code             text not null default '',
  name             extensions.citext not null check (length(trim(name::text)) between 1 and 60),
  description      text check (description is null or length(description) <= 300),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  unique (organization_id, name)
);

create table public.sub_categories (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  category_id      uuid not null,
  code             text not null default '',
  name             extensions.citext not null check (length(trim(name::text)) between 1 and 60),
  description      text check (description is null or length(description) <= 300),
  sla_priority     public.sla_priority,
  asset_fields     jsonb not null default '[]'::jsonb
                     check (private.valid_asset_fields(asset_fields)),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  unique (category_id, name),
  foreign key (organization_id, category_id)
    references public.categories (organization_id, id) on delete restrict
);

create index sub_categories_category_idx on public.sub_categories (organization_id, category_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────────────────

create function private.category_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  part text;
begin
  new.name := trim(new.name::text);
  new.description := nullif(trim(new.description), '');
  if tg_op = 'INSERT' then
    -- One code at a time per client, so two saves can't pick the same one.
    perform pg_advisory_xact_lock(hashtext('categories:' || new.organization_id::text));
    part := private.code_part(new.name, 'X');
    new.code := private.free_code(new.organization_id, 'categories', '', case when part = '' then 'GENR' else part end);
  else
    new.code := old.code;
    new.organization_id := old.organization_id;
  end if;
  return new;
end;
$$;

create trigger categories_before_write before insert or update on public.categories
  for each row execute function private.category_before_write();

create function private.sub_category_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  part text;
  cat_code text;
begin
  new.name := trim(new.name::text);
  new.description := nullif(trim(new.description), '');
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('sub_categories:' || new.organization_id::text));
    select c.code into cat_code
    from public.categories c
    where c.id = new.category_id and c.organization_id = new.organization_id;
    if cat_code is null then
      -- The foreign key reports this too; say it plainly first.
      raise exception 'Choose a category of this organisation.' using errcode = '23503';
    end if;
    part := private.code_part(new.name, '0');
    new.code := private.free_code(new.organization_id, 'sub_categories', cat_code || '-', case when part = '' then 'ITEM' else part end);
  else
    new.code := old.code;
    new.organization_id := old.organization_id;
    new.category_id := old.category_id;
  end if;
  return new;
end;
$$;

create trigger sub_categories_before_write before insert or update on public.sub_categories
  for each row execute function private.sub_category_before_write();

create function private.category_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;
  if exists (select 1 from public.sub_categories s where s.category_id = old.id) then
    raise exception 'Delete its sub-categories first.' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger categories_before_delete before delete on public.categories
  for each row execute function private.category_before_delete();

create trigger categories_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger sub_categories_updated_at before update on public.sub_categories
  for each row execute function private.set_updated_at();

create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function private.audit_row();
create trigger sub_categories_audit after insert or update or delete on public.sub_categories
  for each row execute function private.audit_row();

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security: staff read; Admins write
-- ─────────────────────────────────────────────────────────────────────────

alter table public.categories     enable row level security;
alter table public.sub_categories enable row level security;

create policy "staff read categories" on public.categories for select to authenticated
  using (organization_id in (select private.my_staff_org_ids()));
create policy "admins add categories" on public.categories for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins change categories" on public.categories for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins delete categories" on public.categories for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

create policy "staff read sub-categories" on public.sub_categories for select to authenticated
  using (organization_id in (select private.my_staff_org_ids()));
create policy "admins add sub-categories" on public.sub_categories for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins change sub-categories" on public.sub_categories for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins delete sub-categories" on public.sub_categories for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

-- ─────────────────────────────────────────────────────────────────────────
-- Grants: codes are never written by the app; a sub-category's category
-- is set once
-- ─────────────────────────────────────────────────────────────────────────

revoke all on public.categories, public.sub_categories from anon;
revoke insert, update on public.categories, public.sub_categories from authenticated;

grant insert (organization_id, name, description) on public.categories to authenticated;
grant update (name, description) on public.categories to authenticated;

grant insert (organization_id, category_id, name, description, sla_priority, asset_fields)
  on public.sub_categories to authenticated;
grant update (name, description, sla_priority, asset_fields) on public.sub_categories to authenticated;

revoke execute on function
  private.free_code(uuid, text, text, text),
  private.category_before_write(),
  private.sub_category_before_write(),
  private.category_before_delete()
from public, anon, authenticated;

-- Used by a check constraint and code making; harmless, but not an API.
revoke execute on function private.code_part(text, text), private.valid_asset_fields(jsonb)
  from public, anon;
grant execute on function private.code_part(text, text), private.valid_asset_fields(jsonb)
  to authenticated;
