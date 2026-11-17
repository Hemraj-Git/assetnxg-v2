-- AssetNXG v2 · people and departments (Phase 2, core data)
-- Rules: 02 "People"; 03 §11; 06 §B "Approvals and hierarchy" (owner 17-11-2026).
--
-- - Departments form a tree (parent_id). A department's head is a staff
--   member of the same client, never a support login. Being a head comes from
--   the department, not from a role.
-- - Each person has one department per client (memberships.department_id).
-- - A department can't be deleted while people or sub-departments are linked.
-- - A client always keeps at least one Admin, and nobody removes themselves.
-- - "Invite pending" = the account has never signed in (first_signed_in_at).

-- ─────────────────────────────────────────────────────────────────────────
-- Roles named in SOMSQP-PRO-01 (06 §B)
-- ─────────────────────────────────────────────────────────────────────────

alter type public.app_role add value if not exists 'dean';
alter type public.app_role add value if not exists 'quality_manager';

-- ─────────────────────────────────────────────────────────────────────────
-- First sign-in (for "Invite pending")
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles add column first_signed_in_at timestamptz;

update public.profiles p
set first_signed_in_at = u.last_sign_in_at
from auth.users u
where u.id = p.id and u.last_sign_in_at is not null;

create function private.record_first_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set first_signed_in_at = new.last_sign_in_at
  where id = new.id and first_signed_in_at is null;
  return new;
end;
$$;

create trigger on_auth_user_first_sign_in
  after update of last_sign_in_at on auth.users
  for each row
  when (old.last_sign_in_at is null and new.last_sign_in_at is not null)
  execute function private.record_first_sign_in();

-- ─────────────────────────────────────────────────────────────────────────
-- Departments
-- ─────────────────────────────────────────────────────────────────────────

create table public.departments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  code             text not null,
  name             extensions.citext not null
                     check (length(trim(name::text)) between 1 and 80),
  description      text check (description is null or length(description) <= 500),
  parent_id        uuid,
  head_user_id     uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  unique (organization_id, name),
  check (parent_id is distinct from id),
  -- The parent is in the same client. Deletes are checked by a trigger first
  -- (plain message); this is the backstop.
  foreign key (organization_id, parent_id)
    references public.departments (organization_id, id) on delete restrict
);

comment on table public.departments is
  'A client''s departments as a tree. head_user_id approves the department''s requisitions (06 §B).';

create index departments_parent_idx on public.departments (organization_id, parent_id);
create index departments_head_idx on public.departments (head_user_id);

create trigger departments_updated_at
  before update on public.departments
  for each row execute function private.set_updated_at();

create trigger departments_audit
  after insert or update or delete on public.departments
  for each row execute function private.audit_row();

-- Number (DEP-0001) from the database; code and client never change.
create function private.department_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hit boolean;
begin
  if tg_op = 'INSERT' then
    new.code := private.make_number(new.organization_id, 'department', 'DEP', false);
  else
    new.code := old.code;
    new.organization_id := old.organization_id;
  end if;

  new.name := trim(new.name::text);
  new.description := nullif(trim(new.description), '');

  -- The head is a staff member of this client, not a support login.
  if new.head_user_id is not null and not exists (
    select 1
    from public.memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.head_user_id
      and not m.support_access
      and exists (select 1 from unnest(m.roles) r where r <> 'guest')
      and not private.user_is_support(m.user_id)
  ) then
    raise exception 'The head of department must be a staff member of this organisation.'
      using errcode = '22023';
  end if;

  -- No loops: the new parent must not be this department or one under it.
  if new.parent_id is not null and tg_op = 'UPDATE' then
    with recursive up as (
      select d.id, d.parent_id, 1 as depth
      from public.departments d
      where d.id = new.parent_id
      union all
      select d.id, d.parent_id, up.depth + 1
      from public.departments d
      join up on d.id = up.parent_id
      where up.depth < 50
    )
    select exists (select 1 from up where up.id = new.id) into hit;
    if hit then
      raise exception 'A department can''t sit under itself or one of its own sub-departments.'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger departments_before_write
  before insert or update on public.departments
  for each row execute function private.department_before_write();

-- Plain reasons before the foreign keys would refuse.
create function private.department_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The whole client is being deleted (cascade): nothing to protect.
  if not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;
  if exists (select 1 from public.departments d where d.parent_id = old.id) then
    raise exception 'Move or delete its sub-departments first.' using errcode = '23503';
  end if;
  if exists (select 1 from public.memberships m where m.department_id = old.id) then
    raise exception 'Move its people to another department first.' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger departments_before_delete
  before delete on public.departments
  for each row execute function private.department_before_delete();

-- ─────────────────────────────────────────────────────────────────────────
-- A person's department (one per client)
-- ─────────────────────────────────────────────────────────────────────────

alter table public.memberships add column department_id uuid;

alter table public.memberships
  add constraint memberships_department_fk
  foreign key (organization_id, department_id)
  references public.departments (organization_id, id) on delete restrict;

create index memberships_department_idx on public.memberships (organization_id, department_id);

-- Admins set roles and department; support_access stays platform-only.
revoke insert, update on public.memberships from authenticated;
grant insert (organization_id, user_id, roles, department_id) on public.memberships to authenticated;
grant update (roles, department_id) on public.memberships to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Membership guards
-- ─────────────────────────────────────────────────────────────────────────

-- When someone leaves a client, they stop heading its departments (v1 0035).
create function private.membership_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.departments
  set head_user_id = null
  where organization_id = old.organization_id
    and head_user_id = old.user_id;
  return null;
end;
$$;

create trigger memberships_after_delete
  after delete on public.memberships
  for each row execute function private.membership_after_delete();

-- Nobody removes themselves, and a client always keeps one ordinary Admin.
-- Server paths without a user, platform functions and whole-client deletes
-- are not limited.
create function private.membership_keep_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or coalesce(current_setting('assetnxg.platform_op', true), '') = 'on'
     or old.support_access
     or not exists (select 1 from public.organizations o where o.id = old.organization_id)
  then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' and old.user_id = auth.uid() then
    raise exception 'You can''t remove yourself. Ask another Admin.' using errcode = '42501';
  end if;

  if 'admin' = any (old.roles)
     and (tg_op = 'DELETE' or not ('admin' = any (new.roles)))
     and not exists (
       select 1 from public.memberships m
       where m.organization_id = old.organization_id
         and m.id <> old.id
         and 'admin' = any (m.roles)
         and not m.support_access
     )
  then
    raise exception 'The organisation needs at least one Admin. Make someone else an Admin first.'
      using errcode = '22023';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger memberships_keep_admin
  before update of roles or delete on public.memberships
  for each row execute function private.membership_keep_admin();

-- ─────────────────────────────────────────────────────────────────────────
-- Add a person by email (client Admins)
-- Admins can't read profiles outside their client, so finding an existing
-- account by email happens here. Returns 'added' | 'already_member' |
-- 'no_account' (the app then sends the invite email and calls again).
-- ─────────────────────────────────────────────────────────────────────────

create function public.org_add_member(
  p_org uuid,
  p_email text,
  p_roles public.app_role[],
  p_department uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  email text := lower(trim(p_email));
  uid uuid;
begin
  if not private.has_role(p_org, 'admin') then
    raise exception 'Only an Admin can add people.' using errcode = '42501';
  end if;
  if email is null or email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if email like '%@assetnxg.app' then
    raise exception 'This address can''t be added here.' using errcode = '22023';
  end if;
  if p_roles is null or cardinality(p_roles) = 0 then
    raise exception 'Choose at least one role.' using errcode = '22023';
  end if;
  if 'guest' = any (p_roles) or 'hod' = any (p_roles) then
    raise exception 'That role can''t be given here.' using errcode = '22023';
  end if;

  select p.id into uid from public.profiles p where lower(p.email) = email;
  if uid is null then
    return 'no_account';
  end if;
  if exists (select 1 from public.memberships m where m.organization_id = p_org and m.user_id = uid) then
    return 'already_member';
  end if;

  insert into public.memberships (organization_id, user_id, roles, department_id)
  values (p_org, uid, p_roles, p_department);
  return 'added';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────────────────

alter table public.departments enable row level security;

create policy "staff read departments"
  on public.departments for select to authenticated
  using (organization_id in (select private.my_staff_org_ids()));

create policy "admins add departments"
  on public.departments for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

create policy "admins change departments"
  on public.departments for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

create policy "admins delete departments"
  on public.departments for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

-- ─────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────

revoke all on public.departments from anon;
revoke insert, update on public.departments from authenticated;
grant insert (organization_id, name, description, parent_id, head_user_id) on public.departments to authenticated;
grant update (name, description, parent_id, head_user_id) on public.departments to authenticated;

-- first_signed_in_at is written by the trigger only (profiles' update grant
-- stays full_name, phone).

revoke execute on function
  private.record_first_sign_in(),
  private.department_before_write(),
  private.department_before_delete(),
  private.membership_after_delete(),
  private.membership_keep_admin()
from public, anon, authenticated;

revoke execute on function public.org_add_member(uuid, text, public.app_role[], uuid) from public, anon;
grant execute on function public.org_add_member(uuid, text, public.app_role[], uuid) to authenticated;
