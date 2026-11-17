-- AssetNXG v2 · platform core
-- Platform admins (super admins), client status (active / suspended), support
-- access memberships, and "one client per request" scoping via the x-org-id
-- header. Plan: before-proceeding-forward (owner decisions 17-11-2026).
--
-- Written without DROP statements: existing policies change with ALTER POLICY,
-- helpers with CREATE OR REPLACE (same signatures, grants kept).

-- ─────────────────────────────────────────────────────────────────────────
-- Client status and creator
-- ─────────────────────────────────────────────────────────────────────────

alter table public.organizations
  add column status text not null default 'active'
    constraint organizations_status_check check (status in ('active', 'suspended')),
  add column created_by uuid references public.profiles (id) on delete set null;

comment on column public.organizations.status is
  'active | suspended. Suspended clients: members read nothing; sign-in shows "paused".';

-- New clients are audited too (the foundation audits updates only).
create trigger organizations_audit_insert
  after insert on public.organizations
  for each row execute function private.audit_row();

-- ─────────────────────────────────────────────────────────────────────────
-- Platform admins: an explicit row, never inferred from the email domain.
-- They manage clients but see NO client data unless granted support access.
-- ─────────────────────────────────────────────────────────────────────────

create table public.platform_admins (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
);

comment on table public.platform_admins is
  'AssetNXG super admins. Rows are added with SQL only (no API writes).';

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())
  );
$$;

alter table public.platform_admins enable row level security;

create policy "platform admins read the platform admin list"
  on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()));

revoke all on public.platform_admins from anon;
revoke insert, update, delete on public.platform_admins from authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Current client per request
-- The app sends the client's organisation id as header x-org-id on every
-- request. When present, access helpers only return that organisation: a
-- login that belongs to several clients sees one client per request, even if
-- a query forgets to filter. It can only narrow access, never widen it
-- (membership is still required). No header (cron, server paths) = as before.
-- ─────────────────────────────────────────────────────────────────────────

create function private.request_org_id()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  raw text;
begin
  raw := (nullif(current_setting('request.headers', true), '')::json) ->> 'x-org-id';
  if raw is null or raw = '' then
    return null;
  end if;
  if raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return raw::uuid;
  end if;
  -- A malformed header matches nothing (deny), never "no filter".
  return '00000000-0000-0000-0000-000000000000'::uuid;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Support access: a membership a platform admin grants themselves through
-- the console. Hidden from client lists like support logins; every grant and
-- removal is in the audit log, which the client's Admins can read.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.memberships
  add column support_access boolean not null default false;

-- Clients' Admins may add people and change roles, but never create or turn
-- a membership into support access: only platform functions write that column.
revoke insert, update on public.memberships from authenticated;
grant insert (organization_id, user_id, roles) on public.memberships to authenticated;
grant update (roles) on public.memberships to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Access helpers: active clients only, and only the request's client when
-- the x-org-id header is present. Same signatures, so every policy follows.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function private.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid())
    and o.status = 'active'
    and (private.request_org_id() is null or m.organization_id = private.request_org_id());
$$;

create or replace function private.my_org_ids_with_role(wanted public.app_role[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid())
    and m.roles && wanted
    and o.status = 'active'
    and (private.request_org_id() is null or m.organization_id = private.request_org_id());
$$;

create or replace function private.my_staff_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid())
    and exists (select 1 from unnest(m.roles) r where r <> 'guest')
    and o.status = 'active'
    and (private.request_org_id() is null or m.organization_id = private.request_org_id());
$$;

create or replace function private.has_role(org uuid, wanted public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = (select auth.uid())
      and m.organization_id = org
      and wanted = any (m.roles)
      and o.status = 'active'
      and (private.request_org_id() is null or m.organization_id = private.request_org_id())
  );
$$;

-- Self role change stays blocked, except inside a platform function (which
-- sets assetnxg.platform_op) run by a platform admin, e.g. granting support
-- access to yourself. Clients can't set that flag: it is not a request header
-- and set_config is not exposed through the API.
create or replace function private.prevent_self_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.user_id = auth.uid()
     and not (
       coalesce(current_setting('assetnxg.platform_op', true), '') = 'on'
       and private.is_platform_admin()
     )
  then
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

-- ─────────────────────────────────────────────────────────────────────────
-- Policies (altered in place)
-- ─────────────────────────────────────────────────────────────────────────

-- Platform admins read client records (name, status, modules) to manage
-- them. That is not client data: assets, work orders and people stay closed.
alter policy "members read their organisations"
  on public.organizations
  using (id in (select private.my_org_ids()) or (select private.is_platform_admin()));

-- Support access memberships are hidden like support logins.
alter policy "read memberships"
  on public.memberships
  using (
    user_id = (select auth.uid())
    or (
      organization_id in (select private.my_staff_org_ids())
      and (
        (select private.is_support_user())
        or not (support_access or private.user_is_support(memberships.user_id))
      )
    )
  );

-- People are visible through ordinary memberships only, so a platform admin
-- with support access never appears in a client's people lists.
alter policy "read profiles"
  on public.profiles
  using (
    id = (select auth.uid())
    or (
      (not is_support or (select private.is_support_user()))
      and exists (
        select 1 from public.memberships m
        where m.user_id = profiles.id
          and not m.support_access
          and m.organization_id in (select private.my_staff_org_ids())
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Public lookup by address: brand plus status (for the "paused" message).
-- Replaces org_brand() in the app; org_brand() stays until a cleanup.
-- ─────────────────────────────────────────────────────────────────────────

create function public.org_lookup(org_slug text)
returns table (
  id uuid,
  name text,
  short_name text,
  slug text,
  logo_url text,
  logo_mark_url text,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.short_name, o.slug::text, o.logo_url, o.logo_mark_url, o.status
  from public.organizations o
  where o.slug = org_slug::extensions.citext;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────

revoke execute on function private.is_platform_admin(), private.request_org_id()
  from public, anon;
grant execute on function private.is_platform_admin(), private.request_org_id()
  to authenticated;

revoke execute on function public.org_lookup(text) from public;
grant execute on function public.org_lookup(text) to anon, authenticated;
