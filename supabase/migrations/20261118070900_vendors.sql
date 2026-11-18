-- AssetNXG v2 · vendors (Phase 2, core)
-- Rules: 02 "Vendors"; 03 §1 (VND-#### from the DB, never changed).
-- Owner decisions 18-11-2026:
--   - AMC details stay on the vendor, as in v1 ("Has an AMC with us",
--     contract no., dates), so clients without the Warranty & AMC module can
--     record them. That module adds per-asset contracts pointing here.
--   - What a vendor supplies is picked from the client's categories:
--     category_ids, checked by the database (every id is one of this
--     client's categories); a deleted category drops out of every vendor.
-- Vendors have no login (03 §3). Deleting a vendor linked to assets or
-- spares is refused once those tables exist (their migrations add it).

create table public.vendors (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  code             text not null default '',
  name             extensions.citext not null check (length(trim(name::text)) between 1 and 120),
  category_ids     uuid[] not null default '{}' check (cardinality(category_ids) <= 50),
  contact_person   text check (contact_person is null or length(contact_person) <= 120),
  phone            text check (phone is null or phone ~ '^[+0-9 ()-]{3,20}$'),
  email            text check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  address          text check (address is null or length(address) <= 300),
  has_amc          boolean not null default false,
  amc_contract_no  text check (amc_contract_no is null or length(amc_contract_no) <= 60),
  amc_starts_on    date,
  amc_ends_on      date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  unique (organization_id, name),
  check (amc_starts_on is null or amc_ends_on is null or amc_ends_on >= amc_starts_on)
);

create index vendors_category_ids_idx on public.vendors using gin (category_ids);

-- ─────────────────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────────────────

create function private.vendor_before_write()
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
  new.amc_contract_no := nullif(trim(new.amc_contract_no), '');

  -- No AMC: no AMC details.
  if not new.has_amc then
    new.amc_contract_no := null;
    new.amc_starts_on := null;
    new.amc_ends_on := null;
  end if;

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

create trigger vendors_before_write before insert or update on public.vendors
  for each row execute function private.vendor_before_write();

create trigger vendors_updated_at before update on public.vendors
  for each row execute function private.set_updated_at();

create trigger vendors_audit after insert or update or delete on public.vendors
  for each row execute function private.audit_row();

-- A category that is removed drops out of every vendor that supplied it.
create function private.category_after_delete_vendors()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.vendors v
  set category_ids = array_remove(v.category_ids, old.id)
  where v.organization_id = old.organization_id
    and v.category_ids @> array[old.id];
  return null;
end;
$$;

create trigger categories_after_delete_vendors after delete on public.categories
  for each row execute function private.category_after_delete_vendors();

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security: staff read (technicians pick a vendor on a job);
-- Admins write
-- ─────────────────────────────────────────────────────────────────────────

alter table public.vendors enable row level security;

create policy "staff read vendors" on public.vendors for select to authenticated
  using (organization_id in (select private.my_staff_org_ids()));
create policy "admins add vendors" on public.vendors for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins change vendors" on public.vendors for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins remove vendors" on public.vendors for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

-- ─────────────────────────────────────────────────────────────────────────
-- Grants: the number is never written by the app
-- ─────────────────────────────────────────────────────────────────────────

revoke all on public.vendors from anon;
revoke insert, update on public.vendors from authenticated;

grant insert (organization_id, name, category_ids, contact_person, phone, email, address,
              has_amc, amc_contract_no, amc_starts_on, amc_ends_on)
  on public.vendors to authenticated;
grant update (name, category_ids, contact_person, phone, email, address,
              has_amc, amc_contract_no, amc_starts_on, amc_ends_on)
  on public.vendors to authenticated;

revoke execute on function
  private.vendor_before_write(),
  private.category_after_delete_vendors()
from public, anon, authenticated;
