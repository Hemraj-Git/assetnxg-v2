-- AssetNXG v2 · one SELECT policy per table (advisor 0006)
-- Two permissive SELECT policies are both evaluated for every row. Merge each
-- pair into one with the same meaning.

drop policy "read own profile" on public.profiles;
drop policy "staff read people in their organisations" on public.profiles;

-- Your own profile; or, as staff, people in your organisations — except
-- support logins, which only other support logins see.
create policy "read profiles"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (
      (not is_support or (select private.is_support_user()))
      and exists (
        select 1 from public.memberships m
        where m.user_id = profiles.id
          and m.organization_id in (select private.my_staff_org_ids())
      )
    )
  );

drop policy "read own memberships" on public.memberships;
drop policy "staff read memberships in their organisations" on public.memberships;

-- Your own memberships; or, as staff, your organisations' memberships —
-- support logins hidden from non-support users.
create policy "read memberships"
  on public.memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      organization_id in (select private.my_staff_org_ids())
      and (
        (select private.is_support_user())
        or not private.user_is_support(memberships.user_id)
      )
    )
  );

-- Supabase's event-trigger helper (enables RLS on every new public table).
-- The event trigger runs it as its owner; the API never needs to call it.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
