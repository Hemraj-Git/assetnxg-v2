-- AssetNXG v2 · locations: campuses, buildings, rooms, room types (Phase 2)
-- Rules: 02 "Organization"; 03 §1 (CAM-/BLD-/ROM- numbers from the DB, never
-- changed); 05 gap 5 (delete refused while used); 07 lesson 8 (room types
-- are data, not browser settings).
--
-- - Campus → building → room, each in one client. Moving a building to
--   another campus, or a room to another building, is allowed.
-- - Room types are one list per client; a type in use can't be removed.
-- - Each room has a secret QR key (for its printed QR label), made by the
--   database and never changed.
-- - Occupancy (check-in / check-out) comes with reservations in Phase 3,
--   which adds 'occupied' to room_status.

-- ─────────────────────────────────────────────────────────────────────────
-- Shared trigger: number on insert, keep number and client on update, trim
-- the name. Arguments: counter kind, prefix (e.g. 'campus', 'CAM').
-- ─────────────────────────────────────────────────────────────────────────

create function private.set_code_and_trim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.code := private.make_number(new.organization_id, tg_argv[0], tg_argv[1], false);
  else
    new.code := old.code;
    new.organization_id := old.organization_id;
  end if;
  new.name := trim(new.name::text);
  return new;
end;
$$;

create type public.room_status as enum ('available', 'under_maintenance');

-- ─────────────────────────────────────────────────────────────────────────
-- Campuses
-- ─────────────────────────────────────────────────────────────────────────

create table public.campuses (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  code             text not null default '',
  name             extensions.citext not null check (length(trim(name::text)) between 1 and 80),
  address          text check (address is null or length(address) <= 300),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  unique (organization_id, name)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Buildings / blocks
-- ─────────────────────────────────────────────────────────────────────────

create table public.buildings (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  campus_id        uuid not null,
  code             text not null default '',
  name             extensions.citext not null check (length(trim(name::text)) between 1 and 80),
  total_floors     integer check (total_floors is null or total_floors between 0 and 200),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  unique (campus_id, name),
  foreign key (organization_id, campus_id)
    references public.campuses (organization_id, id) on delete restrict
);

create index buildings_campus_idx on public.buildings (organization_id, campus_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Room types (one list per client)
-- ─────────────────────────────────────────────────────────────────────────

create table public.room_types (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             extensions.citext not null check (length(trim(name::text)) between 1 and 60),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create index room_types_created_by_idx on public.room_types (created_by);

-- ─────────────────────────────────────────────────────────────────────────
-- Rooms / areas
-- ─────────────────────────────────────────────────────────────────────────

create table public.rooms (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  building_id      uuid not null,
  code             text not null default '',
  name             extensions.citext not null check (length(trim(name::text)) between 1 and 80),
  room_type_id     uuid,
  floor            text check (floor is null or length(floor) <= 30),
  area_sqft        numeric(10, 2) check (area_sqft is null or area_sqft >= 0),
  is_reservable    boolean not null default true,
  status           public.room_status not null default 'available',
  -- Secret part of the room's QR link; 128 random bits, never changed.
  qr_key           text not null unique default replace(gen_random_uuid()::text, '-', ''),
  last_printed_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  foreign key (organization_id, building_id)
    references public.buildings (organization_id, id) on delete restrict,
  foreign key (organization_id, room_type_id)
    references public.room_types (organization_id, id) on delete restrict
);

create index rooms_building_idx on public.rooms (organization_id, building_id);
create index rooms_type_idx on public.rooms (organization_id, room_type_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Triggers: numbers, trimming, updated_at, audit
-- ─────────────────────────────────────────────────────────────────────────

create trigger campuses_before_write before insert or update on public.campuses
  for each row execute function private.set_code_and_trim('campus', 'CAM');
create trigger buildings_before_write before insert or update on public.buildings
  for each row execute function private.set_code_and_trim('building', 'BLD');
create trigger rooms_before_write before insert or update on public.rooms
  for each row execute function private.set_code_and_trim('room', 'ROM');

create function private.room_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.floor := nullif(trim(new.floor), '');
  if tg_op = 'UPDATE' then
    new.qr_key := old.qr_key;
  end if;
  return new;
end;
$$;

create trigger rooms_before_write_extra before insert or update on public.rooms
  for each row execute function private.room_before_write();

create function private.room_type_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name := trim(new.name::text);
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.organization_id := old.organization_id;
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create trigger room_types_before_write before insert or update on public.room_types
  for each row execute function private.room_type_before_write();

create function private.campus_before_write_extra()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.address := nullif(trim(new.address), '');
  return new;
end;
$$;

create trigger campuses_before_write_extra before insert or update on public.campuses
  for each row execute function private.campus_before_write_extra();

create trigger campuses_updated_at before update on public.campuses
  for each row execute function private.set_updated_at();
create trigger buildings_updated_at before update on public.buildings
  for each row execute function private.set_updated_at();
create trigger rooms_updated_at before update on public.rooms
  for each row execute function private.set_updated_at();

create trigger campuses_audit after insert or update or delete on public.campuses
  for each row execute function private.audit_row();
create trigger buildings_audit after insert or update or delete on public.buildings
  for each row execute function private.audit_row();
create trigger rooms_audit after insert or update or delete on public.rooms
  for each row execute function private.audit_row();
create trigger room_types_audit after insert or update or delete on public.room_types
  for each row execute function private.audit_row();

-- ─────────────────────────────────────────────────────────────────────────
-- Delete guards: plain reasons before the foreign keys would refuse.
-- A whole client being deleted (cascade) is never blocked.
-- ─────────────────────────────────────────────────────────────────────────

create function private.location_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;

  if tg_table_name = 'campuses'
     and exists (select 1 from public.buildings b where b.campus_id = old.id) then
    raise exception 'Move or delete its buildings first.' using errcode = '23503';
  elsif tg_table_name = 'buildings'
     and exists (select 1 from public.rooms r where r.building_id = old.id) then
    raise exception 'Move or delete its rooms first.' using errcode = '23503';
  elsif tg_table_name = 'room_types'
     and exists (select 1 from public.rooms r where r.room_type_id = old.id) then
    raise exception 'Rooms use this type. Give them another type first.' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger campuses_before_delete before delete on public.campuses
  for each row execute function private.location_before_delete();
create trigger buildings_before_delete before delete on public.buildings
  for each row execute function private.location_before_delete();
create trigger room_types_before_delete before delete on public.room_types
  for each row execute function private.location_before_delete();

-- ─────────────────────────────────────────────────────────────────────────
-- Starting room types for every client (Admins add or remove their own)
-- ─────────────────────────────────────────────────────────────────────────

create function private.seed_room_types(p_org uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.room_types (organization_id, name)
  select p_org, t
  from unnest(array['Classroom', 'Laboratory', 'Office', 'Meeting room', 'Washroom', 'Store room', 'Common area']) as t
  on conflict (organization_id, name) do nothing;
$$;

create function private.organization_after_insert_seed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_room_types(new.id);
  return null;
end;
$$;

create trigger organizations_seed_room_types
  after insert on public.organizations
  for each row execute function private.organization_after_insert_seed();

select private.seed_room_types(o.id) from public.organizations o;

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security: staff read; Admins write
-- ─────────────────────────────────────────────────────────────────────────

alter table public.campuses   enable row level security;
alter table public.buildings  enable row level security;
alter table public.room_types enable row level security;
alter table public.rooms      enable row level security;

create policy "staff read campuses" on public.campuses for select to authenticated
  using (organization_id in (select private.my_staff_org_ids()));
create policy "admins add campuses" on public.campuses for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins change campuses" on public.campuses for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins delete campuses" on public.campuses for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

create policy "staff read buildings" on public.buildings for select to authenticated
  using (organization_id in (select private.my_staff_org_ids()));
create policy "admins add buildings" on public.buildings for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins change buildings" on public.buildings for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins delete buildings" on public.buildings for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

create policy "staff read room types" on public.room_types for select to authenticated
  using (organization_id in (select private.my_staff_org_ids()));
create policy "admins add room types" on public.room_types for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins change room types" on public.room_types for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins delete room types" on public.room_types for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

create policy "staff read rooms" on public.rooms for select to authenticated
  using (organization_id in (select private.my_staff_org_ids()));
create policy "admins add rooms" on public.rooms for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins change rooms" on public.rooms for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins delete rooms" on public.rooms for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

-- ─────────────────────────────────────────────────────────────────────────
-- Grants: numbers, QR keys and print times are never written by the app
-- ─────────────────────────────────────────────────────────────────────────

revoke all on public.campuses, public.buildings, public.room_types, public.rooms from anon;
revoke insert, update on public.campuses, public.buildings, public.room_types, public.rooms from authenticated;

grant insert (organization_id, name, address) on public.campuses to authenticated;
grant update (name, address) on public.campuses to authenticated;

grant insert (organization_id, campus_id, name, total_floors) on public.buildings to authenticated;
grant update (campus_id, name, total_floors) on public.buildings to authenticated;

grant insert (organization_id, name) on public.room_types to authenticated;
grant update (name) on public.room_types to authenticated;

grant insert (organization_id, building_id, name, room_type_id, floor, area_sqft, is_reservable, status)
  on public.rooms to authenticated;
grant update (building_id, name, room_type_id, floor, area_sqft, is_reservable, status)
  on public.rooms to authenticated;

revoke execute on function
  private.set_code_and_trim(),
  private.room_before_write(),
  private.room_type_before_write(),
  private.campus_before_write_extra(),
  private.location_before_delete(),
  private.seed_room_types(uuid),
  private.organization_after_insert_seed()
from public, anon, authenticated;
