# 07 · Lessons from v1 (don't repeat these)

1. **Never let the browser make a number.**
   - v1 computed IDs from the rows the browser could see. Under RLS a technician or guest sees only their own rows, so numbers collided, the insert failed, and the UI had already shown "success".
   - Fixed for tickets, inspections, check-ins and preventive/corrective jobs (0014, 0038, 0058). Housekeeping is still browser-numbered.
   - **v2: every number comes from the DB.**
2. **An UPDATE that matches no rows is not an error.** Under RLS, a write the user isn't allowed to make silently changes nothing. v1 lost asset status changes, room occupancy and ticket cascades this way (0015, 0023, 0024).
   - Check affected rows (`.select()` after update, and treat none as an error).
   - Put cross-role effects in **DB triggers or SECURITY DEFINER functions** (0050).
3. **Effects of a save belong to the database, not the saver's browser.** Next jobs, failed-inspection jobs and asset status were made by whoever finished the work, and refused for non-Admins. Triggers fixed it (0050). Guard against duplicates when two paths can fire.
4. **IST, not UTC.**
   - Cron runs in UTC (23:59 IST = `29 18 * * *`).
   - `toISOString().split('T')[0]` gives the UTC date. Use the local/IST date.
   - The year in IDs uses the IST year (0021).
5. **Real types for dates.** v1 stored dates as text (two formats) and timestamps as display strings. Sorting broke (0017, 0019, 0022). v2: `date` / `timestamptz` only, formatted on screen.
6. **Columns the UI collects must exist.** v1 had whole field sets typed and shown in forms but never saved, because the columns were missing (0010, 0025, 0037). Generate types from the DB (`supabase gen types`) and test round-trips.
7. **Security defaults:**
   - anonymous (guest) sessions are "authenticated", so "any signed-in user can read" is open to the internet (0054);
   - roles must never come from sign-up metadata (0045, 0048);
   - storage buckets must not allow public write (0030);
   - trigger functions must not be callable through RPC (0032);
   - rate-limit public inserts (0054).
8. **Settings in localStorage are per browser.** SLA hours and room types lived in each Admin's browser; phones used defaults (0055, 0056). Settings go in the DB.
9. **One definition per rule.** "Overdue" had three copies that disagreed. Shared pure functions with unit tests (`isWorkOrderOverdue`, `attemptWindow`, `fieldTasks`).
10. **Field app navigation:** use the browser history for sub-screens. After a reload the back stack is gone, so give every sub-screen a direct "home" route.
11. **Support logins** must be filtered from every client-facing list at the data layer, not page by page.
12. **Realtime + RLS:** wrap `auth.uid()` as `(select auth.uid())` in policies (0034). Realtime evaluates them per change per subscriber.
13. **Notifications are server-inserted rows**, which makes the bell, push and email one pipeline. Test traffic must not push (0046).
14. **Status from the source of truth:** after a failed save, re-read rather than trusting optimistic state. Show errors in plain words with the database's reason.
