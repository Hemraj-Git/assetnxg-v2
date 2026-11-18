-- AssetNXG v2 · fix: deleting a contract that was renewed failed. Its
-- foreign key clears the renewal's renewed_from_id, but the update trigger
-- put the old value back. The link is now kept unless it is being cleared,
-- which only that foreign key does (the app has no grant on the column).
-- Found while writing supabase/tests/contracts_deletes.sql.

create or replace function private.contract_before_write()
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
    -- What it renews never changes, except that deleting the original
    -- clears the link (the foreign key does that; the app can't).
    if new.renewed_from_id is not null then
      new.renewed_from_id := old.renewed_from_id;
    end if;
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
