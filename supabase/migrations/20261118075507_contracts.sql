-- AssetNXG v2 · contracts: warranties and AMCs that cover assets (core)
-- Owner decisions 18-11-2026 (06 §A):
--   - An AMC or warranty is a contract covering one or more assets: one
--     vendor servicing 40 ACs = one contract listing 40 assets; different
--     terms = separate contracts. Each asset shows its current cover.
--   - Recording contracts is core; the Warranty & AMC module adds reminders.
--
-- - Kinds: AMC, Comprehensive AMC, Warranty, Extended warranty. An AMC needs
--   a vendor; a warranty may not have one (the maker).
-- - An asset can't be in two overlapping contracts of the same group
--   (maintenance: AMC / Comprehensive AMC; warranty: Warranty / Extended
--   warranty). A warranty and an AMC may overlap.
-- - Renewing makes a new contract that points back (renewed_from_id); a
--   contract is renewed at most once. "Not renewing" stops nagging.
-- - asset_ids lists the covered assets (this client's only, checked here);
--   an asset deleted by mistake drops out of its contracts.

create type public.contract_kind as enum ('amc', 'camc', 'warranty', 'extended_warranty');

create table public.contracts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  code             text not null default '',
  kind             public.contract_kind not null,
  vendor_id        uuid,
  contract_no      text check (contract_no is null or length(contract_no) <= 60),
  starts_on        date not null,
  ends_on          date not null,
  cost             numeric(14, 2) check (cost is null or cost >= 0),
  visits_per_year  integer check (visits_per_year is null or visits_per_year between 0 and 365),
  coverage         text check (coverage is null or length(coverage) <= 500),
  asset_ids        uuid[] not null default '{}' check (cardinality(asset_ids) <= 2000),
  renewed_from_id  uuid,
  not_renewing     boolean not null default false,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  unique (renewed_from_id),
  check (ends_on >= starts_on),
  check (kind in ('warranty', 'extended_warranty') or vendor_id is not null),
  check (renewed_from_id is distinct from id),
  foreign key (organization_id, vendor_id)
    references public.vendors (organization_id, id) on delete restrict,
  foreign key (organization_id, renewed_from_id)
    references public.contracts (organization_id, id) on delete set null (renewed_from_id)
);

create index contracts_asset_ids_idx on public.contracts using gin (asset_ids);
create index contracts_vendor_idx on public.contracts (organization_id, vendor_id);
create index contracts_ends_idx on public.contracts (organization_id, ends_on);
create index contracts_created_by_idx on public.contracts (created_by);

-- Maintenance contracts and warranties are separate groups for overlaps.
create function private.contract_group(k public.contract_kind)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when k in ('amc', 'camc') then 'maintenance' else 'warranty' end;
$$;

create function private.contract_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  clash record;
  bad uuid;
begin
  if tg_op = 'INSERT' then
    new.code := private.make_number(new.organization_id, 'contract', 'CON', false);
    new.created_by := auth.uid();
  else
    new.code := old.code;
    new.organization_id := old.organization_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.renewed_from_id := old.renewed_from_id;
  end if;

  new.contract_no := nullif(trim(new.contract_no), '');
  new.coverage := nullif(trim(new.coverage), '');

  -- Covered assets: no repeats, only this client's, at least one (except
  -- when an asset deleted by mistake drops out).
  new.asset_ids := coalesce(
    (select array_agg(distinct a order by a) from unnest(new.asset_ids) a where a is not null),
    '{}'
  );
  select a into bad
  from unnest(new.asset_ids) a
  where not exists (select 1 from public.assets x where x.id = a and x.organization_id = new.organization_id)
  limit 1;
  if bad is not null then
    raise exception 'Choose assets of this organisation.' using errcode = '23503';
  end if;
  if cardinality(new.asset_ids) = 0
     and coalesce(current_setting('assetnxg.asset_cleanup', true), '') <> 'on' then
    raise exception 'Choose at least one asset the contract covers.' using errcode = '22023';
  end if;

  -- A renewal follows a contract of the same client and the same group.
  if tg_op = 'INSERT' and new.renewed_from_id is not null and not exists (
    select 1 from public.contracts c
    where c.id = new.renewed_from_id
      and c.organization_id = new.organization_id
      and private.contract_group(c.kind) = private.contract_group(new.kind)
  ) then
    raise exception 'A renewal must follow a contract of the same kind.' using errcode = '22023';
  end if;

  -- No asset in two overlapping contracts of the same group.
  select c.code, c.kind, c.starts_on, c.ends_on, x.code as asset_code into clash
  from public.contracts c
  join lateral unnest(c.asset_ids) as ca(asset_id) on ca.asset_id = any (new.asset_ids)
  join public.assets x on x.id = ca.asset_id
  where c.organization_id = new.organization_id
    and c.id <> new.id
    and private.contract_group(c.kind) = private.contract_group(new.kind)
    and c.starts_on <= new.ends_on
    and c.ends_on >= new.starts_on
  order by x.code
  limit 1;
  if found then
    raise exception '% is already covered by % from % to %. Change the dates, or leave it out of one of them.',
      clash.asset_code, clash.code, to_char(clash.starts_on, 'DD-MM-YYYY'), to_char(clash.ends_on, 'DD-MM-YYYY')
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger contracts_before_write before insert or update on public.contracts
  for each row execute function private.contract_before_write();

create trigger contracts_updated_at before update on public.contracts
  for each row execute function private.set_updated_at();

create trigger contracts_audit after insert or update or delete on public.contracts
  for each row execute function private.audit_row();

-- An asset deleted by mistake drops out of the contracts that covered it.
create function private.asset_after_delete_contracts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('assetnxg.asset_cleanup', 'on', true);
  update public.contracts c
  set asset_ids = array_remove(c.asset_ids, old.id)
  where c.organization_id = old.organization_id
    and c.asset_ids @> array[old.id];
  perform set_config('assetnxg.asset_cleanup', '', true);
  return null;
end;
$$;

create trigger assets_after_delete_contracts after delete on public.assets
  for each row execute function private.asset_after_delete_contracts();

-- A vendor with contracts can't be deleted (plain reason; the foreign key
-- is the backstop).
create or replace function private.asset_refs_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;

  if tg_table_name = 'rooms' then
    select count(*) into n from public.assets a where a.room_id = old.id;
    if n > 0 then
      raise exception '% in this room. Move them to another room first.',
        case when n = 1 then 'There is 1 asset' else 'There are ' || n || ' assets' end
        using errcode = '23503';
    end if;
  elsif tg_table_name = 'sub_categories' then
    select count(*) into n from public.assets a where a.sub_category_id = old.id;
    if n > 0 then
      raise exception '% this sub-category. Change their sub-category first.',
        case when n = 1 then '1 asset uses' else n || ' assets use' end
        using errcode = '23503';
    end if;
  elsif tg_table_name = 'vendors' then
    select count(*) into n from public.assets a where a.purchased_from_id = old.id;
    if n > 0 then
      raise exception '% bought from this vendor, so it can''t be deleted.',
        case when n = 1 then '1 asset was' else n || ' assets were' end
        using errcode = '23503';
    end if;
    select count(*) into n from public.contracts c where c.vendor_id = old.id;
    if n > 0 then
      raise exception 'This vendor has % (warranty or AMC), so it can''t be deleted.',
        case when n = 1 then '1 contract' else n || ' contracts' end
        using errcode = '23503';
    end if;
  end if;
  return old;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security: staff read; Admins write
-- ─────────────────────────────────────────────────────────────────────────

alter table public.contracts enable row level security;

create policy "staff read contracts" on public.contracts for select to authenticated
  using (organization_id in (select private.my_staff_org_ids()));
create policy "admins add contracts" on public.contracts for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins change contracts" on public.contracts for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins remove contracts" on public.contracts for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

revoke all on public.contracts from anon;
revoke insert, update on public.contracts from authenticated;

grant insert (organization_id, kind, vendor_id, contract_no, starts_on, ends_on, cost, visits_per_year,
              coverage, asset_ids, renewed_from_id, not_renewing)
  on public.contracts to authenticated;
grant update (kind, vendor_id, contract_no, starts_on, ends_on, cost, visits_per_year,
              coverage, asset_ids, not_renewing)
  on public.contracts to authenticated;

revoke execute on function
  private.contract_before_write(),
  private.asset_after_delete_contracts(),
  private.asset_refs_before_delete()
from public, anon, authenticated;
revoke execute on function private.contract_group(public.contract_kind) from public, anon, authenticated;
