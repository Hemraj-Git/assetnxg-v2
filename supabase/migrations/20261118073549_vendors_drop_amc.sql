-- AssetNXG v2 · vendors: remove the vendor-level AMC (owner, 18-11-2026).
-- An AMC covers specific assets, so it becomes a contract that lists the
-- assets it covers (contracts + contract_assets, built with Assets). The
-- vendors table had no rows when this ran, so nothing is lost.
--
-- Destructive (drops columns): run in the Supabase SQL editor, then record
-- it in supabase_migrations.schema_migrations.

-- The trigger no longer touches the AMC columns (replace it first, so it
-- never refers to a missing column).
create or replace function private.vendor_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.code := private.make_number(new.organization_id, 'vendor', 'VND', false);
  else
    new.code := old.code;
    new.organization_id := old.organization_id;
  end if;

  new.name := trim(new.name::text);
  new.contact_person := nullif(trim(new.contact_person), '');
  new.phone := nullif(trim(new.phone), '');
  new.email := nullif(lower(trim(new.email)), '');
  new.address := nullif(trim(new.address), '');

  -- Categories: no repeats, and only this client's.
  new.category_ids := coalesce(
    (select array_agg(distinct c order by c) from unnest(new.category_ids) c where c is not null),
    '{}'
  );
  if exists (
    select 1 from unnest(new.category_ids) c
    where not exists (
      select 1 from public.categories k where k.id = c and k.organization_id = new.organization_id
    )
  ) then
    raise exception 'Choose categories from the list.' using errcode = '23503';
  end if;
  return new;
end;
$$;

-- Their check constraint and column grants go with them.
alter table public.vendors
  drop column has_amc,
  drop column amc_contract_no,
  drop column amc_starts_on,
  drop column amc_ends_on;
