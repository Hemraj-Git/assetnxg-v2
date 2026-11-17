-- AssetNXG v2 · foundation
-- Organisations (tenants), profiles, memberships with roles, access helpers
-- for RLS, per-organisation numbering, a generic audit log.
-- Rules: docs/context/04-data-model.md ("What changes in v2"), 03 §1 and §11,
-- 07 lessons 1, 4, 7, 11, 12.

-- ─────────────────────────────────────────────────────────────────────────
-- Schemas and extensions
-- ─────────────────────────────────────────────────────────────────────────

-- Helper and trigger functions live here. The schema is not exposed through
-- the Data API, and nothing in it is executable by API roles unless granted.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create extension if not exists citext with schema extensions;

-- ─────────────────────────────────────────────────────────────────────────
-- Roles
-- ─────────────────────────────────────────────────────────────────────────

-- v1 roles plus the procurement roles (06 §B). A membership holds several.
create type public.app_role as enum (
  'admin',
  'faculty',
  'technician',
  'housekeeping',
  'guest',
  'procurement_manager',
  'procurement_executive',
  'hod',
  'accounts',
  'director',
  'security_supervisor',
  'store_incharge'
);

-- ─────────────────────────────────────────────────────────────────────────
-- Generic trigger: updated_at
-- ─────────────────────────────────────────────────────────────────────────

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Organisations
-- ─────────────────────────────────────────────────────────────────────────

create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  short_name    text not null check (length(trim(short_name)) > 0),
  -- Subdomain: <slug>.assetnxg.app
  slug          extensions.citext not null unique
                  check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  logo_url      text,
  logo_mark_url text,
  locale        text not null default 'en-IN',
  currency      char(3) not null default 'INR',
  time_zone     text not null default 'Asia/Kolkata',
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.organizations is
  'One row per client (tenant). Brand, locale, currency and time zone are data, never hard-coded.';

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Profiles (one per auth user, across organisations)
-- ─────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  -- Support logins (any @assetnxg.app address) are never shown to clients.
  is_support  boolean generated always as
                (coalesce(lower(email) like '%@assetnxg.app', false)) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (lower(email));

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- A profile is made for every new auth user. Roles are NEVER read from
-- sign-up metadata (lesson 7, v1 0045/0048): memberships are created only by
-- an organisation Admin or a trusted server path.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep the profile's email in step with auth (email change, guest upgrade).
create function private.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_user_email();

-- ─────────────────────────────────────────────────────────────────────────
-- Memberships (user × organisation, with roles)
-- ─────────────────────────────────────────────────────────────────────────

create table public.memberships (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  roles            public.app_role[] not null check (cardinality(roles) > 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);
create index memberships_roles_idx on public.memberships using gin (roles);

create trigger memberships_updated_at
  before update on public.memberships
  for each row execute function private.set_updated_at();

-- Nobody changes their own roles (v1 0028). Server-side paths without a user
-- (service role, cron, migrations) have auth.uid() = null and pass.
create function private.prevent_self_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.user_id = auth.uid() then
    if tg_op = 'INSERT' then
      raise exception 'You cannot give yourself a role.'
        using errcode = '42501';
    elsif new.roles is distinct from old.roles then
      raise exception 'You cannot change your own role.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger memberships_no_self_role_change
  before insert or update on public.memberships
  for each row execute function private.prevent_self_role_change();

-- ─────────────────────────────────────────────────────────────────────────
-- Access helpers for RLS
-- Use them as `organization_id in (select private.my_org_ids())` so
-- Postgres evaluates them once per statement, not once per row (lesson 12).
-- SECURITY DEFINER so they can read memberships without recursing into RLS.
-- ─────────────────────────────────────────────────────────────────────────

-- Organisations I belong to, in any role.
create function private.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.memberships m
  where m.user_id = (select auth.uid());
$$;

-- Organisations where I hold at least one of the given roles.
create function private.my_org_ids_with_role(wanted public.app_role[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.roles && wanted;
$$;

-- Organisations where I am staff: any role other than guest. Guests read only
-- their own rows (03 §11).
create function private.my_staff_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and exists (select 1 from unnest(m.roles) r where r <> 'guest');
$$;

-- Single check, for use inside functions (not per-row in policies).
create function private.has_role(org uuid, wanted public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = org
      and wanted = any (m.roles)
  );
$$;

create function private.is_support_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_support from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- Is that user a support login? Bypasses profiles RLS on purpose, so the
-- memberships policy can hide support logins without the two policies
-- reading each other (which Postgres rejects as infinite recursion).
create function private.user_is_support(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_support from public.profiles p where p.id = target),
    false
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Dates in the organisation's time zone (lesson 4: never the server's UTC)
-- ─────────────────────────────────────────────────────────────────────────

create function private.org_time_zone(org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select o.time_zone from public.organizations o where o.id = org),
    'Asia/Kolkata'
  );
$$;

create function private.org_today(org uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone private.org_time_zone(org))::date;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Numbering (lesson 1: every human-readable number comes from the database)
-- One counter per organisation, kind and year. Numbers restart per client.
-- Module insert triggers call private.make_number(); the browser never does.
-- ─────────────────────────────────────────────────────────────────────────

create table public.counters (
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  kind             text not null check (kind ~ '^[a-z0-9_]+$'),
  -- 0 for counters that don't restart each year (AST-, VND-, …)
  year             integer not null default 0,
  last_value       bigint not null default 0 check (last_value >= 0),
  primary key (organization_id, kind, year)
);

comment on table public.counters is
  'Per-organisation number counters. Written only by private.next_number(); migration (08) sets them past the highest imported number.';

-- Atomic: concurrent inserts each get a distinct value (row lock on upsert).
create function private.next_number(org uuid, counter_kind text, yearly boolean)
returns table (n_year integer, n_value bigint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  y integer := case
    when yearly then extract(year from private.org_today(org))::integer
    else 0
  end;
begin
  return query
  insert into public.counters as c (organization_id, kind, year, last_value)
  values (org, counter_kind, y, 1)
  on conflict (organization_id, kind, year)
    do update set last_value = c.last_value + 1
  returning c.year, c.last_value;
end;
$$;

-- 'WO-PM' + yearly → WO-PM-2026-0001 ; 'AST' + not yearly → AST-0001.
-- Padding grows naturally past 9999 (lpad never truncates here).
create function private.make_number(
  org uuid,
  counter_kind text,
  prefix text,
  yearly boolean,
  pad integer default 4
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
  digits text;
begin
  select * into n from private.next_number(org, counter_kind, yearly);
  digits := n.n_value::text;
  if length(digits) < pad then
    digits := lpad(digits, pad, '0');
  end if;
  if yearly then
    return prefix || '-' || n.n_year || '-' || digits;
  end if;
  return prefix || '-' || digits;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Audit log (ISO 9001 trail: who, what, when, before/after)
-- Attach private.audit_row() to any business table with organization_id.
-- ─────────────────────────────────────────────────────────────────────────

create table public.audit_log (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  table_name       text not null,
  record_id        uuid,
  action           text not null check (action in ('insert', 'update', 'delete')),
  actor_id         uuid,
  at               timestamptz not null default now(),
  old_data         jsonb,
  new_data         jsonb
);

create index audit_log_org_at_idx on public.audit_log (organization_id, at desc);
create index audit_log_record_idx on public.audit_log (table_name, record_id);

create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  row_j jsonb := coalesce(new_j, old_j);
  org uuid;
begin
  -- organizations itself has no organization_id: its id is the org.
  if tg_table_name = 'organizations' then
    org := (row_j ->> 'id')::uuid;
  else
    org := (row_j ->> 'organization_id')::uuid;
  end if;

  if tg_op = 'UPDATE' and old_j = new_j then
    return null;
  end if;

  insert into public.audit_log
    (organization_id, table_name, record_id, action, actor_id, old_data, new_data)
  values (
    org,
    tg_table_name,
    (row_j ->> 'id')::uuid,
    lower(tg_op),
    auth.uid(),
    old_j,
    new_j
  );
  return null;
end;
$$;

create trigger organizations_audit
  after update on public.organizations
  for each row execute function private.audit_row();

create trigger memberships_audit
  after insert or update or delete on public.memberships
  for each row execute function private.audit_row();

-- ─────────────────────────────────────────────────────────────────────────
-- Public brand lookup (sign-in page, QR landing) before anyone signs in.
-- Returns only what a stranger may see.
-- ─────────────────────────────────────────────────────────────────────────

create function public.org_brand(org_slug text)
returns table (
  id uuid,
  name text,
  short_name text,
  slug text,
  logo_url text,
  logo_mark_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.short_name, o.slug::text, o.logo_url, o.logo_mark_url
  from public.organizations o
  where o.slug = org_slug::extensions.citext;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security
-- Every policy is scoped by organisation membership. Never "any signed-in
-- user": anonymous guest sessions are authenticated too (lesson 7).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.memberships   enable row level security;
alter table public.counters      enable row level security;
alter table public.audit_log     enable row level security;

-- organizations: members read; Admins of that org update. Creating and
-- deleting organisations is a support task done server-side.
create policy "members read their organisations"
  on public.organizations for select to authenticated
  using (id in (select private.my_org_ids()));

create policy "admins update their organisation"
  on public.organizations for update to authenticated
  using (id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

-- profiles: your own; staff see people in their organisations, except
-- support logins (only other support logins see those).
create policy "read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "staff read people in their organisations"
  on public.profiles for select to authenticated
  using (
    (not is_support or (select private.is_support_user()))
    and exists (
      select 1 from public.memberships m
      where m.user_id = profiles.id
        and m.organization_id in (select private.my_staff_org_ids())
    )
  );

create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Only name and phone are user-editable; email follows auth.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone) on public.profiles to authenticated;

-- memberships: your own; staff see their organisation's (support hidden);
-- Admins add, change and remove.
create policy "read own memberships"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()));

create policy "staff read memberships in their organisations"
  on public.memberships for select to authenticated
  using (
    organization_id in (select private.my_staff_org_ids())
    and (
      (select private.is_support_user())
      or not private.user_is_support(memberships.user_id)
    )
  );

create policy "admins add memberships"
  on public.memberships for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

create policy "admins change memberships"
  on public.memberships for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

create policy "admins remove memberships"
  on public.memberships for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

-- counters: no policies. Only private.next_number() (security definer) writes.

-- audit_log: Admins read their organisation's trail. Rows come from triggers.
create policy "admins read audit log"
  on public.audit_log for select to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

-- ─────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────

-- Postgres grants EXECUTE to PUBLIC on new functions. Take it back, then give
-- only what policies and the app need (lesson 7: trigger functions are never
-- callable through the API).
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  private.my_org_ids(),
  private.my_org_ids_with_role(public.app_role[]),
  private.my_staff_org_ids(),
  private.has_role(uuid, public.app_role),
  private.is_support_user(),
  private.user_is_support(uuid),
  private.org_time_zone(uuid),
  private.org_today(uuid)
to authenticated;

revoke execute on function public.org_brand(text) from public;
grant execute on function public.org_brand(text) to anon, authenticated;

-- Tables: nothing for anon. Counters and audit_log are not writable via API.
revoke all on public.organizations, public.profiles, public.memberships,
              public.counters, public.audit_log from anon;
revoke insert, update, delete on public.counters, public.audit_log from authenticated;
revoke insert, delete on public.organizations from authenticated;
revoke insert, delete on public.profiles from authenticated;
