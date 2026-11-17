-- AssetNXG v2 · fix org_add_member: the local variable "email" clashed with
-- profiles.email (42702 ambiguous column). Same behaviour, renamed variable.

create or replace function public.org_add_member(
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
  v_email text := lower(trim(p_email));
  v_uid uuid;
begin
  if not private.has_role(p_org, 'admin') then
    raise exception 'Only an Admin can add people.' using errcode = '42501';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if v_email like '%@assetnxg.app' then
    raise exception 'This address can''t be added here.' using errcode = '22023';
  end if;
  if p_roles is null or cardinality(p_roles) = 0 then
    raise exception 'Choose at least one role.' using errcode = '22023';
  end if;
  if 'guest' = any (p_roles) or 'hod' = any (p_roles) then
    raise exception 'That role can''t be given here.' using errcode = '22023';
  end if;

  select p.id into v_uid from public.profiles p where lower(p.email) = v_email;
  if v_uid is null then
    return 'no_account';
  end if;
  if exists (select 1 from public.memberships m where m.organization_id = p_org and m.user_id = v_uid) then
    return 'already_member';
  end if;

  insert into public.memberships (organization_id, user_id, roles, department_id)
  values (p_org, v_uid, p_roles, p_department);
  return 'added';
end;
$$;
