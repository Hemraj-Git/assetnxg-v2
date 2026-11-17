-- AssetNXG v2 · modules per client, and the super-admin console's functions
-- Plan: before-proceeding-forward (owner decisions 17-11-2026: per-module
-- toggles; console at console.assetnxg.app; super admins see client data only
-- through audited support access).

-- ─────────────────────────────────────────────────────────────────────────
-- Modules
-- Core (always on, no row needed): dashboard, locations, categories, assets,
-- documents, vendors, people, QR codes, reports.
-- ─────────────────────────────────────────────────────────────────────────

create type public.app_module as enum (
  'maintenance',      -- work orders (preventive, corrective), templates, service requests
  'housekeeping',
  'inspections',
  'outside_repairs',
  'reservations',
  'spares',
  'warranty_amc',
  'procurement',
  'ai_assistant'
);

-- One row per client and module once it has ever been set; switched with the
-- enabled flag (keeps history, never deleted).
create table public.organization_modules (
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  module           public.app_module not null,
  enabled          boolean not null default true,
  changed_at       timestamptz not null default now(),
  changed_by       uuid references public.profiles (id) on delete set null,
  primary key (organization_id, module)
);

create trigger organization_modules_audit
  after insert or update on public.organization_modules
  for each row execute function private.audit_row();

alter table public.organization_modules enable row level security;

create policy "members and platform admins read modules"
  on public.organization_modules for select to authenticated
  using (organization_id in (select private.my_org_ids()) or (select private.is_platform_admin()));

revoke all on public.organization_modules from anon;
revoke insert, update, delete on public.organization_modules from authenticated;

-- Every module table's policies add:
--   and (select private.org_has_module(organization_id, '<module>'))
create function private.org_has_module(org uuid, wanted public.app_module)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_modules om
    where om.organization_id = org and om.module = wanted and om.enabled
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Console helpers (private: not callable through the API)
-- ─────────────────────────────────────────────────────────────────────────

create function private.assert_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Only AssetNXG platform admins can do this.' using errcode = '42501';
  end if;
end;
$$;

-- Must match RESERVED in src/lib/org-slug.ts.
create function private.reserved_slugs()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['www', 'app', 'api', 'admin', 'support', 'status', 'docs', 'console'];
$$;

create function private.validate_org_settings(
  p_name text, p_short_name text, p_locale text, p_currency text, p_time_zone text
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce(length(trim(p_name)), 0) = 0 or length(trim(p_name)) > 120 then
    raise exception 'Enter the client''s name (up to 120 characters).' using errcode = '22023';
  end if;
  if coalesce(length(trim(p_short_name)), 0) = 0 or length(trim(p_short_name)) > 20 then
    raise exception 'Enter a short name (up to 20 characters).' using errcode = '22023';
  end if;
  if coalesce(p_locale, '') !~ '^[a-z]{2}(-[A-Z]{2})?$' then
    raise exception 'Choose a language and region, such as en-IN.' using errcode = '22023';
  end if;
  if upper(coalesce(p_currency, '')) !~ '^[A-Z]{3}$' then
    raise exception 'Currency is a three-letter code, such as INR.' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'Choose a time zone from the list.' using errcode = '22023';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Console functions (public: called by the console's Server Actions with the
-- platform admin's own session; each checks platform admin first). Changes
-- land in audit_log through the table triggers, with the admin as actor.
-- ─────────────────────────────────────────────────────────────────────────

-- Client records with counts. No client data: counts only.
create function public.platform_organizations(p_org uuid default null)
returns table (
  id uuid,
  name text,
  short_name text,
  slug text,
  status text,
  locale text,
  currency text,
  time_zone text,
  logo_url text,
  logo_mark_url text,
  created_at timestamptz,
  member_count integer,
  admin_count integer,
  modules public.app_module[],
  my_support_access boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.assert_platform_admin();
  return query
  select
    o.id,
    o.name,
    o.short_name,
    o.slug::text,
    o.status,
    o.locale,
    o.currency::text,
    o.time_zone,
    o.logo_url,
    o.logo_mark_url,
    o.created_at,
    (select count(*)::integer from public.memberships m
      where m.organization_id = o.id and not m.support_access),
    (select count(*)::integer from public.memberships m
      where m.organization_id = o.id and not m.support_access and 'admin' = any (m.roles)),
    coalesce((select array_agg(om.module order by om.module) from public.organization_modules om
      where om.organization_id = o.id and om.enabled), '{}'),
    exists (select 1 from public.memberships m
      where m.organization_id = o.id and m.user_id = (select auth.uid()) and m.support_access)
  from public.organizations o
  where p_org is null or o.id = p_org
  order by o.name;
end;
$$;

create function public.platform_create_organization(
  p_name text,
  p_short_name text,
  p_slug text,
  p_locale text default 'en-IN',
  p_currency text default 'INR',
  p_time_zone text default 'Asia/Kolkata',
  p_modules public.app_module[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  s text := lower(trim(coalesce(p_slug, '')));
begin
  perform private.assert_platform_admin();
  perform private.validate_org_settings(p_name, p_short_name, p_locale, p_currency, p_time_zone);

  if s = any (private.reserved_slugs()) then
    raise exception 'The address "%" is reserved. Choose another.', s using errcode = '22023';
  end if;
  if s !~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$' then
    raise exception 'Use up to 40 lower-case letters, digits and hyphens for the address, not starting or ending with a hyphen.'
      using errcode = '22023';
  end if;

  begin
    insert into public.organizations (name, short_name, slug, locale, currency, time_zone, created_by)
    values (trim(p_name), trim(p_short_name), s, p_locale, upper(p_currency), p_time_zone, auth.uid())
    returning organizations.id into new_id;
  exception when unique_violation then
    raise exception 'The address "%" is already taken.', s using errcode = '23505';
  end;

  insert into public.organization_modules (organization_id, module, enabled, changed_by)
  select new_id, u.m, true, auth.uid()
  from unnest(coalesce(p_modules, '{}')) as u(m)
  on conflict do nothing;

  return new_id;
end;
$$;

create function public.platform_update_organization(
  p_org uuid, p_name text, p_short_name text, p_locale text, p_currency text, p_time_zone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();
  perform private.validate_org_settings(p_name, p_short_name, p_locale, p_currency, p_time_zone);

  update public.organizations
  set name = trim(p_name), short_name = trim(p_short_name), locale = p_locale,
      currency = upper(p_currency), time_zone = p_time_zone
  where organizations.id = p_org;

  if not found then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- Logos must live in this project's public "branding" bucket (no hotlinking
-- of outside images into every client's sign-in page). NULL removes a logo.
create function public.platform_set_logo(p_org uuid, p_kind text, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();

  if p_kind not in ('wide', 'mark') then
    raise exception 'Logo kind is "wide" or "mark".' using errcode = '22023';
  end if;
  if p_url is not null
     and p_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/branding/[^?#]+$' then
    raise exception 'Upload the logo through the console.' using errcode = '22023';
  end if;

  if p_kind = 'wide' then
    update public.organizations set logo_url = p_url where organizations.id = p_org;
  else
    update public.organizations set logo_mark_url = p_url where organizations.id = p_org;
  end if;

  if not found then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;
end;
$$;

create function public.platform_set_status(p_org uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();

  if p_status not in ('active', 'suspended') then
    raise exception 'Status is "active" or "suspended".' using errcode = '22023';
  end if;

  update public.organizations set status = p_status where organizations.id = p_org;

  if not found then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- Sets exactly the given modules on; every other module off.
create function public.platform_set_modules(p_org uuid, p_modules public.app_module[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();

  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;

  insert into public.organization_modules (organization_id, module, enabled, changed_at, changed_by)
  select p_org, e.m, e.m = any (coalesce(p_modules, '{}')), now(), auth.uid()
  from unnest(enum_range(null::public.app_module)) as e(m)
  on conflict (organization_id, module) do update
    set enabled = excluded.enabled, changed_at = excluded.changed_at, changed_by = excluded.changed_by
    where organization_modules.enabled is distinct from excluded.enabled;
end;
$$;

-- Adds an existing account to a client (e.g. the client's first Admin after
-- the invite email has created the account). Returns added | already_member |
-- no_account; the console invites first when there is no account.
create function public.platform_add_member(p_org uuid, p_email text, p_roles public.app_role[])
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  perform private.assert_platform_admin();

  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;

  select p.id into uid from public.profiles p where lower(p.email) = lower(trim(p_email));
  if uid is null then
    return 'no_account';
  end if;
  if exists (select 1 from public.memberships m where m.organization_id = p_org and m.user_id = uid) then
    return 'already_member';
  end if;

  perform set_config('assetnxg.platform_op', 'on', true);
  insert into public.memberships (organization_id, user_id, roles) values (p_org, uid, p_roles);
  perform set_config('assetnxg.platform_op', '', true);
  return 'added';
end;
$$;

-- Support access: the platform admin joins the client as Admin, hidden from
-- the client's people lists, recorded in the audit log.
create function public.platform_grant_support(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing boolean;
begin
  perform private.assert_platform_admin();

  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;

  select m.support_access into existing
  from public.memberships m
  where m.organization_id = p_org and m.user_id = auth.uid();

  if existing then
    return;
  elsif existing is not null then
    raise exception 'You are already a member of this client, so support access is not needed.'
      using errcode = '22023';
  end if;

  perform set_config('assetnxg.platform_op', 'on', true);
  insert into public.memberships (organization_id, user_id, roles, support_access)
  values (p_org, auth.uid(), '{admin}', true);
  perform set_config('assetnxg.platform_op', '', true);
end;
$$;

create function public.platform_revoke_support(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();

  delete from public.memberships m
  where m.organization_id = p_org and m.user_id = auth.uid() and m.support_access;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Client logos: public "branding" bucket. Anyone may view a logo (sign-in
-- page); only platform admins upload. PNG, JPEG or WebP up to 1 MB (no SVG:
-- an SVG opened directly can run script).
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "platform admins upload client logos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (select private.is_platform_admin()));

create policy "platform admins replace client logos"
  on storage.objects for update to authenticated
  using (bucket_id = 'branding' and (select private.is_platform_admin()))
  with check (bucket_id = 'branding' and (select private.is_platform_admin()));

-- ─────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────

revoke execute on function
  private.org_has_module(uuid, public.app_module),
  private.assert_platform_admin(),
  private.reserved_slugs(),
  private.validate_org_settings(text, text, text, text, text)
from public, anon, authenticated;

grant execute on function private.org_has_module(uuid, public.app_module) to authenticated;

revoke execute on function
  public.platform_organizations(uuid),
  public.platform_create_organization(text, text, text, text, text, text, public.app_module[]),
  public.platform_update_organization(uuid, text, text, text, text, text),
  public.platform_set_logo(uuid, text, text),
  public.platform_set_status(uuid, text),
  public.platform_set_modules(uuid, public.app_module[]),
  public.platform_add_member(uuid, text, public.app_role[]),
  public.platform_grant_support(uuid),
  public.platform_revoke_support(uuid)
from public, anon;

grant execute on function
  public.platform_organizations(uuid),
  public.platform_create_organization(text, text, text, text, text, text, public.app_module[]),
  public.platform_update_organization(uuid, text, text, text, text, text),
  public.platform_set_logo(uuid, text, text),
  public.platform_set_status(uuid, text),
  public.platform_set_modules(uuid, public.app_module[]),
  public.platform_add_member(uuid, text, public.app_role[]),
  public.platform_grant_support(uuid),
  public.platform_revoke_support(uuid)
to authenticated;
