-- AssetNXG v2 · fix: a head's own requisition goes up the tree even while
-- someone stands in for them (the stand-in is usually their own junior).
-- Found by supabase/tests/approval_hierarchy.sql.

create or replace function private.resolve_department_approver(p_org uuid, p_department uuid, p_requester uuid)
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

    if dep.head_user_id is not null and private.is_staff_member(p_org, dep.head_user_id)
       and dep.head_user_id <> p_requester then
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

      return query select
        dep.head_user_id, null::public.app_role, dep.id, null::uuid,
        format('%s, head of %s', private.person_name(dep.head_user_id), dep.name)
        || coalesce(', because ' || why, '');
      return;
    elsif dep.head_user_id = p_requester then
      -- A head never has their own requisition approved in their department,
      -- not even by their stand-in: it goes up.
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
