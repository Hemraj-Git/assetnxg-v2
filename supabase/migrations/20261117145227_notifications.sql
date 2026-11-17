-- AssetNXG v2 · notifications (the header bell; push and email reuse these rows)
-- Rules: docs/context/03-business-rules.md §12, 07 lesson 13.
--
-- - Rows are written by the server only: later phases' triggers and cron jobs
--   call private.notify(). Nobody inserts or deletes through the API.
-- - A person reads only their own rows, and only in the client of this request
--   (my_org_ids() follows x-org-id), so a login in two clients never sees the
--   other client's alerts.
-- - People may only mark their own rows read or dismissed.
-- - Realtime publishes changes; it applies the same RLS to each subscriber.

-- v1's types (03 §12). New modules add values with `alter type … add value`.
create type public.notification_type as enum (
  'wo_assigned',
  'inspection_assigned',
  'auto_checkout',
  'vendor_handover',
  'outside_repair_sent',
  'outside_repair_overdue',
  'request_resolved',
  'request_escalated',
  'request_closed',
  'due_today'
);

create table public.notifications (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  type             public.notification_type not null,
  title            text not null check (length(trim(title)) > 0),
  body             text,
  -- What it is about: the table and row, and the human number shown in the
  -- bell (WO-PM-2026-0042), copied at insert so the list needs no joins.
  ref_table        text,
  ref_id           uuid,
  ref_number       text,
  read_at          timestamptz,
  dismissed_at     timestamptz,
  pushed_at        timestamptz,
  created_at       timestamptz not null default now()
);

-- The bell: newest first, per person and client, dismissed ones left out.
create index notifications_feed_idx
  on public.notifications (user_id, organization_id, created_at desc)
  where dismissed_at is null;
create index notifications_org_idx on public.notifications (organization_id);

alter table public.notifications enable row level security;

create policy "people read their own notifications"
  on public.notifications for select to authenticated
  using (
    user_id = (select auth.uid())
    and organization_id in (select private.my_org_ids())
  );

create policy "people mark their own notifications"
  on public.notifications for update to authenticated
  using (
    user_id = (select auth.uid())
    and organization_id in (select private.my_org_ids())
  )
  with check (
    user_id = (select auth.uid())
    and organization_id in (select private.my_org_ids())
  );

revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at, dismissed_at) on public.notifications to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- The one way in: private.notify(). For triggers and cron (security definer
-- functions owned by postgres); not callable through the API.
-- Returns the new id, or null when the person is not a member of the client.
-- ─────────────────────────────────────────────────────────────────────────

create function private.notify(
  p_org        uuid,
  p_user       uuid,
  p_type       public.notification_type,
  p_title      text,
  p_body       text default null,
  p_ref_table  text default null,
  p_ref_id     uuid default null,
  p_ref_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_org and m.user_id = p_user
  ) then
    return null;
  end if;

  insert into public.notifications
    (organization_id, user_id, type, title, body, ref_table, ref_id, ref_number)
  values
    (p_org, p_user, p_type, p_title, p_body, p_ref_table, p_ref_id, p_ref_number)
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function
  private.notify(uuid, uuid, public.notification_type, text, text, text, uuid, text)
  from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime: the bell updates live.
-- ─────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.notifications;
