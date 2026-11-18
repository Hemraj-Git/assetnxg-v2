-- AssetNXG v2 · approval hierarchy: stand-ins and "who approves this person's
-- requisition" (06 §B "Approvals and hierarchy", owner 17-11-2026).
--
-- - A stand-in covers an approver on leave, for dates in the client's time
--   zone. Set by an Admin, or by the approver for themselves.
-- - private.resolve_department_approver walks up the department tree from the
--   requester's department to the first head who is active staff and not the
--   requester (using their stand-in while one is active). Past the top, it
--   goes to the Director / Principal role. The procurement module calls it
--   when a requisition is submitted; Admins can preview it for everyone.

-- ─────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────

-- Active staff of the client: a member with a non-guest role, not support
-- access, not a support login.
create function private.is_staff_member(p_org uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_org
      and m.user_id = p_user
      and not m.support_access
      and exists (select 1 from unnest(m.roles) r where r <> 'guest')
      and not private.user_is_support(m.user_id)
  );
$$;

create function private.person_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(p.full_name), ''), p.email, 'Someone')
  from public.profiles p
  where p.id = p_user;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Stand-ins
-- ─────────────────────────────────────────────────────────────────────────

create table public.approval_delegations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  from_user_id     uuid not null references public.profiles (id) on delete cascade,
  to_user_id       uuid not null references public.profiles (id) on delete cascade,
  starts_on        date not null,
  ends_on          date not null,
  reason           text check (reason is null or length(reason) <= 200),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  check (from_user_id <> to_user_id),
  check (ends_on >= starts_on),
  check (ends_on - starts_on <= 366)
);

comment on table public.approval_delegations is
  'Stand-ins: to_user approves in place of from_user from starts_on to ends_on (client time zone).';

create index approval_delegations_from_idx
  on public.approval_delegations (organization_id, from_user_id, ends_on);
create index approval_delegations_to_idx on public.approval_delegations (to_user_id);
create index approval_delegations_created_by_idx on public.approval_delegations (created_by);

create trigger approval_delegations_audit
  after insert or update or delete on public.approval_delegations
  for each row execute function private.audit_row();

create function private.delegation_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  clash record;
begin
  new.created_by := auth.uid();
  new.reason := nullif(trim(new.reason), '');

  if not private.is_staff_member(new.organization_id, new.from_user_id) then
    raise exception 'Only staff of this organisation can have a stand-in.' using errcode = '22023';
  end if;
  if not private.is_staff_member(new.organization_id, new.to_user_id) then
    raise exception 'The stand-in must be a staff member of this organisation.' using errcode = '22023';
  end if;
  if new.ends_on < private.org_today(new.organization_id) then
    raise exception 'The end date has already passed.' using errcode = '22023';
  end if;

  select d.starts_on, d.ends_on into clash
  from public.approval_delegations d
  where d.organization_id = new.organization_id
    and d.from_user_id = new.from_user_id
    and d.starts_on <= new.ends_on
    and d.ends_on >= new.starts_on
  limit 1;
  if found then
    raise exception 'There is already a stand-in from % to %. Remove it first, or choose other dates.',
      to_char(clash.starts_on, 'DD-MM-YYYY'), to_char(clash.ends_on, 'DD-MM-YYYY')
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger approval_delegations_before_insert
  before insert on public.approval_delegations
  for each row execute function private.delegation_before_insert();

-- ─────────────────────────────────────────────────────────────────────────
-- Who approves a requisition at the "Head of Department" step
-- Returns one row: a person (approver_user_id) or, past the top of the tree,
-- a role (approver_role = 'director'). on_behalf_of = the head a stand-in
-- covers. note = a plain sentence for the approval trail.
-- ─────────────────────────────────────────────────────────────────────────

create function private.resolve_department_approver(p_org uuid, p_department uuid, p_requester uuid)
returns table (
  approver_user_id uuid,
  approver_role public.app_role,
  department_id uuid,
  on_behalf_of uuid,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cur uuid := p_department;
  dep record;
  standin uuid;
  standin_until date;
  why text;          -- why the first department was passed over
  depth int := 0;
begin
  if p_department is null then
    why := 'the requester has no department';
  end if;

  while cur is not null and depth < 50 loop
    select d.id, d.name::text as name, d.parent_id, d.head_user_id
      into dep
    from public.departments d
    where d.id = cur and d.organization_id = p_org;
    exit when not found;

    if dep.head_user_id is not null and private.is_staff_member(p_org, dep.head_user_id) then
      select d.to_user_id, d.ends_on into standin, standin_until
      from public.approval_delegations d
      where d.organization_id = p_org
        and d.from_user_id = dep.head_user_id
        and private.org_today(p_org) between d.starts_on and d.ends_on
        and private.is_staff_member(p_org, d.to_user_id)
      order by d.created_at desc
      limit 1;

      if standin is not null and standin <> p_requester then
        return query select
          standin, null::public.app_role, dep.id, dep.head_user_id,
          format('%s, standing in for %s (head of %s) until %s',
                 private.person_name(standin), private.person_name(dep.head_user_id),
                 dep.name, to_char(standin_until, 'DD-MM-YYYY'))
          || coalesce(', because ' || why, '');
        return;
      end if;

      if dep.head_user_id <> p_requester then
        return query select
          dep.head_user_id, null::public.app_role, dep.id, null::uuid,
          format('%s, head of %s', private.person_name(dep.head_user_id), dep.name)
          || coalesce(', because ' || why, '');
        return;
      end if;

      why := coalesce(why, format('the requester heads %s', dep.name));
    else
      why := coalesce(why, format('%s has no head', dep.name));
    end if;

    standin := null;
    cur := dep.parent_id;
    depth := depth + 1;
  end loop;

  return query select
    null::uuid, 'director'::public.app_role, null::uuid, null::uuid,
    'The Director / Principal' || coalesce(', because ' || why, '')
      || case when p_department is not null then ' and no department above has a head who can approve' else '' end;
end;
$$;

-- For Admins: where each person's requisitions would go today.
create function public.org_approver_map(p_org uuid)
returns table (
  user_id uuid,
  approver_user_id uuid,
  approver_role public.app_role,
  on_behalf_of uuid,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_org, 'admin') then
    raise exception 'Only an Admin can see this.' using errcode = '42501';
  end if;

  return query
  select m.user_id, r.approver_user_id, r.approver_role, r.on_behalf_of, r.note
  from public.memberships m
  cross join lateral private.resolve_department_approver(p_org, m.department_id, m.user_id) r
  where m.organization_id = p_org
    and not m.support_access
    and exists (select 1 from unnest(m.roles) x where x <> 'guest')
    and not private.user_is_support(m.user_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────────────────

alter table public.approval_delegations enable row level security;

-- Admins see all; a person sees the stand-ins they gave and the ones they hold.
create policy "read stand-ins"
  on public.approval_delegations for select to authenticated
  using (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    or (
      organization_id in (select private.my_staff_org_ids())
      and (select auth.uid()) in (from_user_id, to_user_id)
    )
  );

create policy "admins or the approver add stand-ins"
  on public.approval_delegations for insert to authenticated
  with check (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    or (
      organization_id in (select private.my_staff_org_ids())
      and from_user_id = (select auth.uid())
    )
  );

create policy "admins or the approver remove stand-ins"
  on public.approval_delegations for delete to authenticated
  using (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    or (
      organization_id in (select private.my_staff_org_ids())
      and from_user_id = (select auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Grants (no updates: remove and add again)
-- ─────────────────────────────────────────────────────────────────────────

revoke all on public.approval_delegations from anon;
revoke insert, update on public.approval_delegations from authenticated;
grant insert (organization_id, from_user_id, to_user_id, starts_on, ends_on, reason)
  on public.approval_delegations to authenticated;

revoke execute on function
  private.is_staff_member(uuid, uuid),
  private.person_name(uuid),
  private.delegation_before_insert(),
  private.resolve_department_approver(uuid, uuid, uuid)
from public, anon, authenticated;

revoke execute on function public.org_approver_map(uuid) from public, anon;
grant execute on function public.org_approver_map(uuid) to authenticated;
