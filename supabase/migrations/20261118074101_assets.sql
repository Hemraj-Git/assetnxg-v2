-- AssetNXG v2 · assets (Phase 2, core)
-- Rules: 02 "Assets"; 03 §1 (AST-#### from the DB), §2 (installation date
-- locked once created; last serviced date for legacy assets; SLA priority
-- per asset); 07 lesson 2 (writes that match nothing are errors in the app).
--
-- - An asset sits in one room and one sub-category of the same client.
-- - spec_values holds the sub-category's extra fields, keyed by field key.
--   The database keeps only the sub-category's current fields, checks each
--   value's type (text ≤ 200, number, ISO date) and that required ones are
--   filled.
-- - Warranty and AMC are contracts that cover assets (owner, 18-11-2026),
--   added in the next migration. Schedules, documents, photos, QR printing
--   and maintenance history come with their modules.
-- - Rooms, sub-categories and vendors in use by an asset can't be deleted
--   (plain reasons); someone leaving the client stops being assigned.

create type public.asset_status as enum ('operational', 'under_maintenance', 'in_storage', 'retired');

create table public.assets (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  code                text not null default '',
  name                text not null check (length(trim(name)) between 1 and 120),
  sub_category_id     uuid not null,
  room_id             uuid not null,
  status              public.asset_status not null default 'operational',
  sla_priority        public.sla_priority,
  manufacturer        text check (manufacturer is null or length(manufacturer) <= 80),
  model               text check (model is null or length(model) <= 80),
  serial_no           text check (serial_no is null or length(serial_no) <= 80),
  price               numeric(14, 2) check (price is null or price >= 0),
  purchase_date       date,
  installation_date   date,
  last_serviced_on    date,
  purchased_from_id   uuid,
  assigned_to         uuid references public.profiles (id) on delete set null,
  spec_values         jsonb not null default '{}'::jsonb check (jsonb_typeof(spec_values) = 'object'),
  notes               text check (notes is null or length(notes) <= 1000),
  retired_on          date,
  retire_reason       text check (retire_reason is null or length(retire_reason) <= 200),
  -- Secret part of the asset's QR link; 128 random bits, never changed.
  qr_key              text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  check (installation_date is null or purchase_date is null or installation_date >= purchase_date),
  check (last_serviced_on is null or installation_date is null or last_serviced_on >= installation_date),
  check ((status = 'retired') = (retired_on is not null)),
  foreign key (organization_id, sub_category_id)
    references public.sub_categories (organization_id, id) on delete restrict,
  foreign key (organization_id, room_id)
    references public.rooms (organization_id, id) on delete restrict,
  foreign key (organization_id, purchased_from_id)
    references public.vendors (organization_id, id) on delete restrict
);

create index assets_room_idx on public.assets (organization_id, room_id);
create index assets_sub_category_idx on public.assets (organization_id, sub_category_id);
create index assets_vendor_idx on public.assets (organization_id, purchased_from_id);
create index assets_assigned_idx on public.assets (assigned_to);
create index assets_created_by_idx on public.assets (created_by);
create index assets_status_idx on public.assets (organization_id, status);

-- ─────────────────────────────────────────────────────────────────────────
-- Specifications: keep the sub-category's fields only; check types and
-- required values. Returns the cleaned object or raises a plain reason.
-- ─────────────────────────────────────────────────────────────────────────

create function private.clean_spec_values(p_fields jsonb, p_values jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  f jsonb;
  k text;
  v jsonb;
  out jsonb := '{}'::jsonb;
begin
  for f in select * from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) loop
    k := f ->> 'key';
    v := p_values -> k;
    if v is null or jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'string' and trim(v #>> '{}') = '') then
      if coalesce((f ->> 'required')::boolean, false) then
        raise exception 'Fill in “%”.', f ->> 'label' using errcode = '22023';
      end if;
      continue;
    end if;

    if f ->> 'type' = 'number' then
      if jsonb_typeof(v) <> 'number' then
        raise exception '“%” must be a number.', f ->> 'label' using errcode = '22023';
      end if;
    elsif f ->> 'type' = 'date' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception '“%” must be a date.', f ->> 'label' using errcode = '22023';
      end if;
      begin
        perform (v #>> '{}')::date;
      exception when others then
        raise exception '“%” must be a real date.', f ->> 'label' using errcode = '22023';
      end;
    else
      if jsonb_typeof(v) <> 'string' then
        v := to_jsonb(v #>> '{}');
      end if;
      v := to_jsonb(trim(v #>> '{}'));
      if length(v #>> '{}') > 200 then
        raise exception 'Keep “%” under 200 characters.', f ->> 'label' using errcode = '22023';
      end if;
    end if;
    out := out || jsonb_build_object(k, v);
  end loop;
  return out;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Before write: number, locked fields, tidy text, specifications, assignee
-- ─────────────────────────────────────────────────────────────────────────

create function private.asset_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fields jsonb;
  today date := private.org_today(new.organization_id);
begin
  if tg_op = 'INSERT' then
    new.code := private.make_number(new.organization_id, 'asset', 'AST', false);
    new.created_by := auth.uid();
  else
    new.code := old.code;
    new.organization_id := old.organization_id;
    new.qr_key := old.qr_key;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    -- Installation date is locked once the asset exists (03 §2), unless it
    -- was never set.
    if old.installation_date is not null then
      new.installation_date := old.installation_date;
    end if;
  end if;

  new.name := trim(new.name);
  new.manufacturer := nullif(trim(new.manufacturer), '');
  new.model := nullif(trim(new.model), '');
  new.serial_no := nullif(trim(new.serial_no), '');
  new.notes := nullif(trim(new.notes), '');
  new.retire_reason := nullif(trim(new.retire_reason), '');

  if new.purchase_date > today then
    raise exception 'The purchase date can''t be in the future.' using errcode = '22023';
  end if;
  if new.last_serviced_on > today then
    raise exception 'The last serviced date can''t be in the future.' using errcode = '22023';
  end if;

  -- Retired: when and why; anything else: neither.
  if new.status <> 'retired' then
    new.retired_on := null;
    new.retire_reason := null;
  elsif new.retired_on is null then
    new.retired_on := today;
  end if;

  -- The person it's assigned to is staff of this client.
  if new.assigned_to is not null and not private.is_staff_member(new.organization_id, new.assigned_to) then
    raise exception 'Assign it to a staff member of this organisation.' using errcode = '22023';
  end if;

  -- Specifications follow the sub-category.
  select s.asset_fields into fields
  from public.sub_categories s
  where s.id = new.sub_category_id and s.organization_id = new.organization_id;
  if not found then
    raise exception 'Choose a sub-category of this organisation.' using errcode = '23503';
  end if;
  new.spec_values := private.clean_spec_values(fields, coalesce(new.spec_values, '{}'::jsonb));

  return new;
end;
$$;

create trigger assets_before_write before insert or update on public.assets
  for each row execute function private.asset_before_write();

create trigger assets_updated_at before update on public.assets
  for each row execute function private.set_updated_at();

create trigger assets_audit after insert or update or delete on public.assets
  for each row execute function private.audit_row();

-- ─────────────────────────────────────────────────────────────────────────
-- Things assets use can't be deleted while used (plain reasons)
-- ─────────────────────────────────────────────────────────────────────────

create function private.asset_refs_before_delete()
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
  end if;
  return old;
end;
$$;

create trigger rooms_before_delete_assets before delete on public.rooms
  for each row execute function private.asset_refs_before_delete();
create trigger sub_categories_before_delete_assets before delete on public.sub_categories
  for each row execute function private.asset_refs_before_delete();
create trigger vendors_before_delete_assets before delete on public.vendors
  for each row execute function private.asset_refs_before_delete();

-- Someone who leaves the client is no longer assigned its assets (and, as
-- before, stops heading its departments).
create or replace function private.membership_after_delete()
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

  update public.assets
  set assigned_to = null
  where organization_id = old.organization_id
    and assigned_to = old.user_id;
  return null;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security: staff read; Admins write
-- ─────────────────────────────────────────────────────────────────────────

alter table public.assets enable row level security;

create policy "staff read assets" on public.assets for select to authenticated
  using (organization_id in (select private.my_staff_org_ids()));
create policy "admins add assets" on public.assets for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins change assets" on public.assets for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins remove assets" on public.assets for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

-- ─────────────────────────────────────────────────────────────────────────
-- Grants: number, QR key and who created it are never written by the app
-- ─────────────────────────────────────────────────────────────────────────

revoke all on public.assets from anon;
revoke insert, update on public.assets from authenticated;

grant insert (organization_id, name, sub_category_id, room_id, status, sla_priority, manufacturer, model,
              serial_no, price, purchase_date, installation_date, last_serviced_on, purchased_from_id,
              assigned_to, spec_values, notes, retired_on, retire_reason)
  on public.assets to authenticated;
grant update (name, sub_category_id, room_id, status, sla_priority, manufacturer, model,
              serial_no, price, purchase_date, installation_date, last_serviced_on, purchased_from_id,
              assigned_to, spec_values, notes, retired_on, retire_reason)
  on public.assets to authenticated;

revoke execute on function
  private.clean_spec_values(jsonb, jsonb),
  private.asset_before_write(),
  private.asset_refs_before_delete()
from public, anon, authenticated;
