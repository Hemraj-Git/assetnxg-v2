# 08 · Moving SoMS and PMS to v2 (later)

**Now:** both clients stay on v1, with fixes only. v1 code is in `afms-app`; SoMS deploys from its `main`, PMS from the `afms-pms` release copy. Each has its own Supabase project. **v2 never connects to those databases during the build.**

**When v2 is ready, per client:**

1. **Create the organisation in v2** (name, short name, logo, locale, SLA hours, room types, procurement settings).
2. **Export from v1** with a read-only script against that client's database, using env from the owner (never in git or chat). Export every table in `04-data-model.md` plus storage files.
3. **Transform:**
   - add `organization_id`; convert text dates to `date` / `timestamptz` (both YYYY-MM-DD and DD-MM-YYYY occur); map v1 roles to v2 memberships;
   - **keep every existing number** (AST-, SR-, WO-, INSP-, RSV-, OSR-, AL-), and set the v2 counters past the highest number per kind and year;
   - turn `warranty_till` and AMC columns into contracts;
   - keep placeholders `PENDING-<id>` for unassigned jobs.
4. **Users:** recreate auth users in v2 with the same emails. People set a new password through a reset email; never move password hashes by hand. Guests' anonymous accounts are not moved; their requests keep the name, email and phone.
5. **Files:** copy storage objects and rewrite URLs.
6. **Rehearse on a copy**, compare counts and spot-check records, then freeze v1 (read-only), migrate, switch the subdomain (`soms.assetnxg.app`) to v2, and keep v1 read-only for a while.

v1 already has data-load tooling with a schema fingerprint check (`supabase/baseline/fingerprint.sql`, `scripts/`, `docs/DATA-LOAD.md` in `afms-app`). Reuse its ideas, since it refuses a database that isn't in the expected shape.
