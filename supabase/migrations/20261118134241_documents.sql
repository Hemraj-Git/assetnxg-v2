-- AssetNXG v2 · documents library (Phase 2, core)
-- Rules: 02 "Documents" (library: title, type, file; link to assets or
-- spares); 03 §1 (DOC-YYYY-####, IST year, made by the database), §11
-- (staff read documents, guests never; storage has no public write and no
-- deletes through the API); 06 §A (a contract has its document).
--
-- - Files live in a PRIVATE bucket "documents" under <organization id>/…
--   (v1's bucket was public by URL; invoices and contracts are not public).
--   Staff of that client read them through short-lived signed links; only
--   its Admins upload. PDF, JPEG, PNG, WebP or Word (.docx), up to 25 MB.
-- - The browser uploads straight to storage (a signed upload link from the
--   server), then the document row is saved. The database checks the file
--   exists in this client's folder and records its real size and type.
-- - A document can be linked to many assets and contracts (an invoice for
--   40 ACs; an AMC contract and its invoice). Spares join with their slice.
--   Something deleted by mistake drops out of the links.
-- - Deleting a document removes the record and its links; the file itself
--   stays in storage (no deletes through the API), so support can recover it.

create type public.document_type as enum ('invoice', 'warranty', 'user_guide', 'amc_contract', 'other');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 26214400,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  code             text not null default '',
  title            text not null check (length(trim(title)) between 1 and 120),
  doc_type         public.document_type not null default 'other',
  file_path        text not null,
  file_name        text not null check (length(file_name) between 1 and 200),
  file_type        text not null default '',
  file_size        bigint not null default 0,
  asset_ids        uuid[] not null default '{}' check (cardinality(asset_ids) <= 2000),
  contract_ids     uuid[] not null default '{}' check (cardinality(contract_ids) <= 200),
  uploaded_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  unique (file_path)
);

create index documents_asset_ids_idx on public.documents using gin (asset_ids);
create index documents_contract_ids_idx on public.documents using gin (contract_ids);
create index documents_uploaded_by_idx on public.documents (uploaded_by);

create function private.document_before_write()
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
    -- The file must already be uploaded into this client's folder.
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

  -- Links: no repeats, this client's assets and contracts only.
  new.asset_ids := coalesce(
    (select array_agg(distinct a order by a) from unnest(new.asset_ids) a where a is not null), '{}');
  new.contract_ids := coalesce(
    (select array_agg(distinct c order by c) from unnest(new.contract_ids) c where c is not null), '{}');

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

  return new;
end;
$$;

create trigger documents_before_write before insert or update on public.documents
  for each row execute function private.document_before_write();

create trigger documents_updated_at before update on public.documents
  for each row execute function private.set_updated_at();

create trigger documents_audit after insert or update or delete on public.documents
  for each row execute function private.audit_row();

-- An asset or contract deleted by mistake drops out of its documents' links.
create function private.document_links_after_delete()
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
  end if;
  return null;
end;
$$;

create trigger assets_after_delete_documents after delete on public.assets
  for each row execute function private.document_links_after_delete();
create trigger contracts_after_delete_documents after delete on public.contracts
  for each row execute function private.document_links_after_delete();

-- Link or unlink documents to one asset or contract in one statement (no
-- read-then-write race). Runs as the caller, so RLS and column grants apply:
-- only this client's Admins can change links. Returns how many changed.
create function public.link_documents(
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
  if p_target not in ('asset', 'contract') then
    raise exception 'Unknown link target.' using errcode = '22023';
  end if;
  if p_target = 'asset' then
    update public.documents d
    set asset_ids = case when p_link
                         then array_append(array_remove(d.asset_ids, p_target_id), p_target_id)
                         else array_remove(d.asset_ids, p_target_id) end
    where d.organization_id = p_org
      and d.id = any (p_document_ids);
  else
    update public.documents d
    set contract_ids = case when p_link
                            then array_append(array_remove(d.contract_ids, p_target_id), p_target_id)
                            else array_remove(d.contract_ids, p_target_id) end
    where d.organization_id = p_org
      and d.id = any (p_document_ids);
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row-level security: staff read; Admins write
-- ─────────────────────────────────────────────────────────────────────────

alter table public.documents enable row level security;

create policy "staff read documents" on public.documents for select to authenticated
  using (organization_id in (select private.my_staff_org_ids()));
create policy "admins add documents" on public.documents for insert to authenticated
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins change documents" on public.documents for update to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])))
  with check (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));
create policy "admins remove documents" on public.documents for delete to authenticated
  using (organization_id in (select private.my_org_ids_with_role(array['admin']::public.app_role[])));

revoke all on public.documents from anon;
revoke insert, update on public.documents from authenticated;
grant insert (organization_id, title, doc_type, file_path, file_name, asset_ids, contract_ids)
  on public.documents to authenticated;
grant update (title, doc_type, asset_ids, contract_ids) on public.documents to authenticated;

-- Files: the first folder is the client's id. Staff of that client read
-- (signed links); its Admins upload. No update or delete through the API.
create policy "staff read their client's documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (select o::text from private.my_staff_org_ids() o)
  );
create policy "admins upload their client's documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select o::text from private.my_org_ids_with_role(array['admin']::public.app_role[]) o
    )
  );

revoke execute on function
  private.document_before_write(),
  private.document_links_after_delete()
from public, anon, authenticated;
revoke execute on function public.link_documents(uuid, uuid[], text, uuid, boolean) from public, anon;
grant execute on function public.link_documents(uuid, uuid[], text, uuid, boolean) to authenticated;
