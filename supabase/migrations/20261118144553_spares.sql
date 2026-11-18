-- AssetNXG v2 · spares and stock movements (Phase 2, Spares module)
-- Rules: 02 "Spares (Inventory Hub)"; 03 §1 (INV-#### from the database),
-- §10 (low stock = quantity ≤ minimum, default 2 when unset; 0 = out of
-- stock; deploy as asset creates the asset, gives it the spare's documents
-- and takes 1 from stock; v2 keeps the spare at 0 and records every stock
-- change); 04 item 4 (stock movements).
--
-- - A spare belongs to a sub-category, so it has the same specification
--   fields as assets of that kind and carries them over when deployed.
-- - The quantity changes only through stock movements (opening, received,
--   issued, corrected, deployed). Each records who, when, why and the
--   balance after it; stock never goes below zero. Movements are never
--   edited or removed. Procurement adds receipts, issues and counts later.
-- - Deploying creates the asset (same details and specifications), takes 1
--   from stock, gives the asset the spare's documents, and turns a warranty
--   date still running into a warranty contract on the asset.
-- - A spare with stock history (anything after its opening stock) can't be
--   deleted; it stays with its history. Rooms, sub-categories and vendors
--   used by spares can't be deleted.
-- - Everything here needs the Spares module ('spares').

create type public.stock_reason as enum ('opening', 'received', 'issued', 'adjusted', 'deployed');

create table public.spares (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  code             text not null default '',
  name             text not null check (length(trim(name)) between 1 and 120),
  sub_category_id  uuid not null,
  manufacturer     text check (manufacturer is null or length(manufacturer) <= 80),
  model            text check (model is null or length(model) <= 80),
  part_no          text check (part_no is null or length(part_no) <= 80),
  serial_no        text check (serial_no is null or length(serial_no) <= 80),
  quantity         integer not null default 0 check (quantity between 0 and 1000000),
  min_stock        integer check (min_stock is null or min_stock between 0 and 1000000),
  unit_cost        numeric(14, 2) check (unit_cost is null or unit_cost >= 0),
  room_id          uuid,
  storage_note     text check (storage_note is null or length(storage_note) <= 120),
  handling_note    text check (handling_note is null or length(handling_note) <= 500),
  vendor_id        uuid,
  purchase_date    date,
  warranty_till    date,
  spec_values      jsonb not null default '{}'::jsonb check (jsonb_typeof(spec_values) = 'object'),
  notes            text check (notes is null or length(notes) <= 1000),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  check (warranty_till is null or purchase_date is null or warranty_till >= purchase_date),
  foreign key (organization_id, sub_category_id)
    references public.sub_categories (organization_id, id) on delete restrict,
  foreign key (organization_id, room_id)
    references public.rooms (organization_id, id) on delete restrict,
  foreign key (organization_id, vendor_id)
    references public.vendors (organization_id, id) on delete restrict
);

create index spares_sub_category_idx on public.spares (organization_id, sub_category_id);
create index spares_room_idx on public.spares (organization_id, room_id);
create index spares_vendor_idx on public.spares (organization_id, vendor_id);
create index spares_created_by_idx on public.spares (created_by);

create table public.stock_movements (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  spare_id         uuid not null,
  change           integer not null default 0,
  reason           public.stock_reason not null,
  -- "Correct the count": the counted quantity; the change is worked out
  -- under a lock so two people can't race.
  counted          integer check (counted is null or counted between 0 and 1000000),
  balance_after    integer not null default 0,
  note             text check (note is null or length(note) <= 200),
  asset_id         uuid,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (organization_id, spare_id)
    references public.spares (organization_id, id) on delete cascade,
  foreign key (organization_id, asset_id)
    references public.assets (organization_id, id) on delete set null (asset_id)
);

create index stock_movements_spare_idx on public.stock_movements (organization_id, spare_id, created_at desc);
create index stock_movements_asset_idx on public.stock_movements (organization_id, asset_id);
create index stock_movements_created_by_idx on public.stock_movements (created_by);

-- ─────────────────────────────────────────────────────────────────────────
-- Spares: numbers, tidy text, specifications from the sub-category, and a
-- quantity that only stock movements change.
-- ─────────────────────────────────────────────────────────────────────────

create function private.spare_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fields jsonb;
begin
  if tg_op = 'INSERT' then
    new.code := private.make_number(new.organization_id, 'spare', 'INV', false);
    new.created_by := auth.uid();
  else
    new.code := old.code;
    new.organization_id := old.organization_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if coalesce(current_setting('assetnxg.stock_move', true), '') <> 'on' then
      new.quantity := old.quantity;
    end if;
  end if;

  new.name := trim(new.name);
  new.manufacturer := nullif(trim(new.manufacturer), '');
  new.model := nullif(trim(new.model), '');
  new.part_no := nullif(trim(new.part_no), '');
  new.serial_no := nullif(trim(new.serial_no), '');
  new.storage_note := nullif(trim(new.storage_note), '');
  new.handling_note := nullif(trim(new.handling_note), '');
  new.notes := nullif(trim(new.notes), '');

  if new.purchase_date > private.org_today(new.organization_id) then
    raise exception 'The purchase date can''t be in the future.' using errcode = '22023';
  end if;

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

create trigger spares_before_write before insert or update on public.spares
  for each row execute function private.spare_before_write();
create trigger spares_updated_at before update on public.spares
  for each row execute function private.set_updated_at();
create trigger spares_audit after insert or update or delete on public.spares
  for each row execute function private.audit_row();

-- The stock a spare starts with is its first movement ("Opening stock").
create function private.spare_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.quantity > 0 then
    perform set_config('assetnxg.stock_opening', 'on', true);
    insert into public.stock_movements (organization_id, spare_id, change, reason, balance_after, created_by)
    values (new.organization_id, new.id, new.quantity, 'opening', new.quantity, auth.uid());
    perform set_config('assetnxg.stock_opening', '', true);
  end if;
  return null;
end;
$$;

create trigger spares_after_insert after insert on public.spares
  for each row execute function private.spare_after_insert();

-- Only a spare with no stock history beyond its opening can be deleted.
create function private.spare_before_delete()
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
  select count(*) into n from public.stock_movements m where m.spare_id = old.id and m.reason <> 'opening';
  if n > 0 then
    raise exception 'This spare has stock history (% %), so it stays on record. Set its stock to 0 instead.',
      n, case when n = 1 then 'change' else 'changes' end
      using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger spares_before_delete before delete on public.spares
  for each row execute function private.spare_before_delete();

-- ─────────────────────────────────────────────────────────────────────────
-- Stock movements: the only way the quantity changes.
-- ─────────────────────────────────────────────────────────────────────────

create function private.stock_movement_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  q integer;
begin
  new.created_by := auth.uid();
  new.created_at := now();
  new.note := nullif(trim(new.note), '');

  -- Opening stock is written only when the spare is added.
  if new.reason = 'opening' then
    if coalesce(current_setting('assetnxg.stock_opening', true), '') <> 'on' then
      raise exception 'Opening stock is set when the spare is added.' using errcode = '22023';
    end if;
    new.balance_after := new.change;
    new.counted := null;
    return new;
  end if;

  select s.quantity into q
  from public.spares s
  where s.id = new.spare_id and s.organization_id = new.organization_id
  for update;
  if not found then
    raise exception 'Choose a spare of this organisation.' using errcode = '23503';
  end if;

  if new.reason = 'adjusted' then
    if new.counted is null then
      raise exception 'Enter the quantity counted.' using errcode = '22023';
    end if;
    new.change := new.counted - q;
    if new.change = 0 then
      raise exception 'The stock is already %.', q using errcode = '22023';
    end if;
  else
    new.counted := null;
    if new.reason = 'received' and new.change <= 0 then
      raise exception 'Enter how many were received.' using errcode = '22023';
    elsif new.reason in ('issued', 'deployed') and new.change >= 0 then
      raise exception 'Enter how many were taken out.' using errcode = '22023';
    end if;
  end if;

  if new.reason = 'deployed' then
    if new.change <> -1 or new.asset_id is null then
      raise exception 'Deploy a spare with "Deploy as asset".' using errcode = '22023';
    end if;
  elsif new.asset_id is not null and not exists (
    select 1 from public.assets a where a.id = new.asset_id and a.organization_id = new.organization_id
  ) then
    raise exception 'Choose an asset of this organisation.' using errcode = '23503';
  end if;

  if q + new.change < 0 then
    raise exception 'Only % in stock.', q using errcode = '22023';
  end if;
  if q + new.change > 1000000 then
    raise exception 'That is more than the stock can hold (1,000,000).' using errcode = '22023';
  end if;

  new.balance_after := q + new.change;
  perform set_config('assetnxg.stock_move', 'on', true);
  update public.spares set quantity = new.balance_after where id = new.spare_id;
  perform set_config('assetnxg.stock_move', '', true);
  return new;
end;
$$;

create trigger stock_movements_before_insert before insert on public.stock_movements
  for each row execute function private.stock_movement_before_insert();

-- ─────────────────────────────────────────────────────────────────────────
-- Rooms, sub-categories and vendors used by spares can't be deleted (same
-- function as for assets and contracts, now also counting spares).
-- ─────────────────────────────────────────────────────────────────────────

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
    select count(*) into n from public.spares s where s.room_id = old.id;
    if n > 0 then
      raise exception '% stored in this room. Move them to another room first.',
        case when n = 1 then '1 spare is' else n || ' spares are' end
        using errcode = '23503';
    end if;
  elsif tg_table_name = 'sub_categories' then
    select count(*) into n from public.assets a where a.sub_category_id = old.id;
    if n > 0 then
      raise exception '% this sub-category. Change their sub-category first.',
        case when n = 1 then '1 asset uses' else n || ' assets use' end
        using errcode = '23503';
    end if;
    select count(*) into n from public.spares s where s.sub_category_id = old.id;
    if n > 0 then
      raise exception '% this sub-category. Change their sub-category first.',
        case when n = 1 then '1 spare uses' else n || ' spares use' end
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
    select count(*) into n from public.spares s where s.vendor_id = old.id;
    if n > 0 then
      raise exception 'This vendor supplies % on record, so it can''t be deleted.',
        case when n = 1 then '1 spare' else n || ' spares' end
        using errcode = '23503';
    end if;
  end if;
  return old;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Documents link to spares too (spare_ids), like assets and contracts.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.documents
  add column spare_ids uuid[] not null default '{}' check (cardinality(spare_ids) <= 500);
create index documents_spare_ids_idx on public.documents using gin (spare_ids);

create or replace function private.document_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  obj record;
  bad uuid;
begin
  if tg_op = 'INSERT' then
    if split_part(new.file_path, '/', 1) <> new.organization_id::text then
      raise exception 'Upload the file again.' using errcode = '22023';
    end if;
    select o.metadata into obj
    from storage.objects o
    where o.bucket_id = 'documents' and o.name = new.file_path;
    if not found then
      raise exception 'The file didn''t finish uploading. Choose it again.' using errcode = '22023';
    end if;
    new.code := private.make_number(new.organization_id, 'document', 'DOC', true);
    new.uploaded_by := auth.uid();
    new.file_type := coalesce(obj.metadata ->> 'mimetype', '');
    new.file_size := coalesce((obj.metadata ->> 'size')::bigint, 0);
  else
    new.organization_id := old.organization_id;
    new.code := old.code;
    new.file_path := old.file_path;
    new.file_name := old.file_name;
    new.file_type := old.file_type;
    new.file_size := old.file_size;
    new.uploaded_by := old.uploaded_by;
    new.created_at := old.created_at;
  end if;

  new.title := trim(new.title);
  new.file_name := trim(new.file_name);

  new.asset_ids := coalesce(
    (select array_agg(distinct a order by a) from unnest(new.asset_ids) a where a is not null), '{}');
  new.contract_ids := coalesce(
    (select array_agg(distinct c order by c) from unnest(new.contract_ids) c where c is not null), '{}');
  new.spare_ids := coalesce(
    (select array_agg(distinct s order by s) from unnest(new.spare_ids) s where s is not null), '{}');

  select a into bad from unnest(new.asset_ids) a
  where not exists (select 1 from public.assets x where x.id = a and x.organization_id = new.organization_id)
  limit 1;
  if bad is not null then
    raise exception 'Choose assets of this organisation.' using errcode = '23503';
  end if;
  select c into bad from unnest(new.contract_ids) c
  where not exists (select 1 from public.contracts x where x.id = c and x.organization_id = new.organization_id)
  limit 1;
  if bad is not null then
    raise exception 'Choose contracts of this organisation.' using errcode = '23503';
  end if;
  select s into bad from unnest(new.spare_ids) s
  where not exists (select 1 from public.spares x where x.id = s and x.organization_id = new.organization_id)
  limit 1;
  if bad is not null then
    raise exception 'Choose spares of this organisation.' using errcode = '23503';
  end if;

  return new;
end;
$$;

create or replace function private.document_links_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'assets' then
    update public.documents d
    set asset_ids = array_remove(d.asset_ids, old.id)
    where d.organization_id = old.organization_id
      and d.asset_ids @> array[old.id];
  elsif tg_table_name = 'contracts' then
    update public.documents d
    set contract_ids = array_remove(d.contract_ids, old.id)
    where d.organization_id = old.organization_id
      and d.contract_ids @> array[old.id];
  elsif tg_table_name = 'spares' then
    update public.documents d
    set spare_ids = array_remove(d.spare_ids, old.id)
    where d.organization_id = old.organization_id
      and d.spare_ids @> array[old.id];
  end if;
  return null;
end;
$$;

create trigger spares_after_delete_documents after delete on public.spares
  for each row execute function private.document_links_after_delete();

create or replace function public.link_documents(
  p_org uuid,
  p_document_ids uuid[],
  p_target text,
  p_target_id uuid,
  p_link boolean
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if p_target not in ('asset', 'contract', 'spare') then
    raise exception 'Unknown link target.' using errcode = '22023';
  end if;
  if p_target = 'asset' then
    update public.documents d
    set asset_ids = case when p_link
                         then array_append(array_remove(d.asset_ids, p_target_id), p_target_id)
                         else array_remove(d.asset_ids, p_target_id) end
    where d.organization_id = p_org
      and d.id = any (p_document_ids);
  elsif p_target = 'contract' then
    update public.documents d
    set contract_ids = case when p_link
                            then array_append(array_remove(d.contract_ids, p_target_id), p_target_id)
                            else array_remove(d.contract_ids, p_target_id) end
    where d.organization_id = p_org
      and d.id = any (p_document_ids);
  else
    update public.documents d
    set spare_ids = case when p_link
                         then array_append(array_remove(d.spare_ids, p_target_id), p_target_id)
                         else array_remove(d.spare_ids, p_target_id) end
    where d.organization_id = p_org
      and d.id = any (p_document_ids);
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant insert (spare_ids) on public.documents to authenticated;
grant update (spare_ids) on public.documents to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Deploy a spare as an asset, in one step. Runs as the caller, so RLS and
-- every asset rule apply (Admins of this client, Spares module on).
-- ─────────────────────────────────────────────────────────────────────────

create function public.deploy_spare(
  p_org uuid,
  p_spare uuid,
  p_room uuid,
  p_name text default null,
  p_serial_no text default null,
  p_installation_date date default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s record;
  today date := private.org_today(p_org);
  installed date := coalesce(p_installation_date, private.org_today(p_org));
  a_id uuid;
  a_code text;
begin
  select * into s from public.spares x where x.id = p_spare and x.organization_id = p_org for update;
  if not found then
    raise exception 'This spare was changed or removed meanwhile. Refresh the page.' using errcode = '22023';
  end if;
  if p_room is null or not exists (select 1 from public.rooms r where r.id = p_room and r.organization_id = p_org) then
    raise exception 'Choose the room or area where the asset goes.' using errcode = '22023';
  end if;
  if s.quantity < 1 then
    raise exception 'None of % left in stock to deploy.', s.code using errcode = '22023';
  end if;
  if installed > today then
    raise exception 'The installation date can''t be in the future.' using errcode = '22023';
  end if;
  if s.purchase_date is not null and installed < s.purchase_date then
    raise exception 'The installation date can''t be before the purchase date (%).',
      to_char(s.purchase_date, 'DD-MM-YYYY') using errcode = '22023';
  end if;

  insert into public.assets (
    organization_id, name, sub_category_id, room_id, manufacturer, model, serial_no, price,
    purchase_date, installation_date, purchased_from_id, spec_values, notes
  ) values (
    p_org, coalesce(nullif(trim(p_name), ''), s.name), s.sub_category_id, p_room, s.manufacturer, s.model,
    nullif(trim(p_serial_no), ''), s.unit_cost, s.purchase_date, installed, s.vendor_id, s.spec_values,
    'Deployed from spare ' || s.code || '.'
  )
  returning id, code into a_id, a_code;

  insert into public.stock_movements (organization_id, spare_id, change, reason, asset_id, note)
  values (p_org, p_spare, -1, 'deployed', a_id, 'Deployed as ' || a_code);

  -- The asset gets the spare's documents (they stay on the spare too).
  update public.documents d
  set asset_ids = array_append(d.asset_ids, a_id)
  where d.organization_id = p_org and d.spare_ids @> array[p_spare];

  -- A warranty still running becomes a warranty contract on the asset.
  if s.warranty_till is not null and s.warranty_till >= installed then
    insert into public.contracts (organization_id, kind, vendor_id, starts_on, ends_on, coverage, asset_ids)
    values (
      p_org, 'warranty', null, coalesce(s.purchase_date, installed), s.warranty_till,
      'Warranty carried over from spare ' || s.code || '.', array[a_id]
    );
  end if;

  return a_code;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security: staff read; Admins write; Spares module on.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.spares enable row level security;
alter table public.stock_movements enable row level security;

create policy "staff read spares" on public.spares for select to authenticated
  using (
    organization_id in (select private.my_staff_org_ids())
    and (select private.org_has_module(organization_id, 'spares'))
  );
create policy "admins add spares" on public.spares for insert to authenticated
  with check (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    and (select private.org_has_module(organization_id, 'spares'))
  );
create policy "admins change spares" on public.spares for update to authenticated
  using (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    and (select private.org_has_module(organization_id, 'spares'))
  )
  with check (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    and (select private.org_has_module(organization_id, 'spares'))
  );
create policy "admins remove spares" on public.spares for delete to authenticated
  using (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    and (select private.org_has_module(organization_id, 'spares'))
  );

create policy "staff read stock movements" on public.stock_movements for select to authenticated
  using (
    organization_id in (select private.my_staff_org_ids())
    and (select private.org_has_module(organization_id, 'spares'))
  );
create policy "admins record stock movements" on public.stock_movements for insert to authenticated
  with check (
    organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[]))
    and (select private.org_has_module(organization_id, 'spares'))
  );

revoke all on public.spares from anon;
revoke all on public.stock_movements from anon;
revoke insert, update on public.spares from authenticated;
revoke insert, update, delete on public.stock_movements from authenticated;

grant insert (organization_id, name, sub_category_id, manufacturer, model, part_no, serial_no, quantity,
              min_stock, unit_cost, room_id, storage_note, handling_note, vendor_id, purchase_date,
              warranty_till, spec_values, notes)
  on public.spares to authenticated;
grant update (name, sub_category_id, manufacturer, model, part_no, serial_no, min_stock, unit_cost,
              room_id, storage_note, handling_note, vendor_id, purchase_date, warranty_till, spec_values, notes)
  on public.spares to authenticated;
grant insert (organization_id, spare_id, change, reason, counted, note, asset_id)
  on public.stock_movements to authenticated;

revoke execute on function
  private.spare_before_write(),
  private.spare_after_insert(),
  private.spare_before_delete(),
  private.stock_movement_before_insert()
from public, anon, authenticated;
revoke execute on function public.deploy_spare(uuid, uuid, uuid, text, text, date) from public, anon;
grant execute on function public.deploy_spare(uuid, uuid, uuid, text, text, date) to authenticated;
