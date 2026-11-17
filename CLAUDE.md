# AssetNXG v2: instructions for Claude

AssetNXG is a facility and asset management system (CAFM / CMMS) sold to institutes under each client's brand. **v2 is a fresh build** of a product that is already live (`afms-app`, "v1"), with a new design and new modules.

**Read `docs/context/00-README.md` first, then every file it lists, before planning or writing code.** That folder is the requirements: the v1 product, its business rules, its data model, the redesign, and the new modules. Ask when it is silent or contradicts itself; don't guess.

## Working rules (from the product owner)

- **Git**
  - Never commit on `main`. Make one branch per change, and merge to main only when the owner says so.
  - Push only after the owner says so; never force-push.
- **Secrets**
  - Secrets never go in git or chat. Env files (`.env.local`, `.env.*`) are written by the owner.
  - Never print, echo or commit keys. The Supabase secret key, DB password, `ANTHROPIC_API_KEY`, `SENTRY_AUTH_TOKEN` and similar live only in env files and in Vercel.
- **Database**
  - This project has its **own** Supabase project. Never connect to, query or change the v1 databases (SoMS, PMS).
  - Every schema change is a migration file in `supabase/migrations`, applied locally first.
- **Support logins:** `admin@assetnxg.app` and any `@assetnxg.app` account are support logins. They are never shown to clients: not in user lists, assign-to pickers or reports.
- **Naming**
  - The product is **AssetNXG**, never "AFMS" (v1's old name, still in its code).
  - Client names and logos come from settings and are never hard-coded.
- **UI language:** plain words for the user, not system words: "Can start from", not "Attempt window"; "Done by", not "Execution mode".
- **Locale:**
  - Dates DD-MM-YYYY on screen, ISO 8601 in exports and the database.
  - Time zone Asia/Kolkata: "today", day boundaries and the year in IDs follow IST, never the server's UTC.
  - Currency ₹ by default, as an organisation setting.
- **Next.js:** this is Next.js 16 and its APIs differ from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code, and heed deprecation notices.
- **Tests:** unit tests (Vitest) for rules. Don't run the full Playwright E2E suite routinely, only when asked or before a release.
- **Done means verified:** report what was tested and what was not. Never claim a fix works without checking it.

## Architecture (agreed; details in docs/context/06-new-modules.md and the plan)

- **Framework:** Next.js 16 App Router, TypeScript strict, Server Components and Server Actions.
- **Supabase access:** `@supabase/ssr` with a server client, a browser client only for Realtime, and session refresh in the proxy.
- **Database:**
  - **Multi-tenant**: one database for all clients, `organization_id` on every business table, RLS on every table.
  - Roles and permissions are per organisation membership.
  - **One client per request:** data reads and writes use `requireMember()` / `requireModule()` from `src/lib/auth.ts` (or `createClient({ orgId })`), which send `x-org-id`; the database then shows only that client, even to a login in several clients.
  - **Modules:** every table that belongs to a module (procurement, housekeeping…) adds `and (select private.org_has_module(organization_id, '<module>'))` to its policies, and its pages call `requireModule()`. Core features have no module.
  - **Platform admins** (super admins, the console at `console.assetnxg.app`) are rows in `platform_admins`, never inferred from the email domain. They see no client data except through audited support access.
  - **The secret key** is used only in `src/lib/supabase/auth-admin.ts` to send invite emails; never for reading or writing data.
- **Numbering:** every human-readable number (AST-, WO-, SR-, PO-…) is made by the database (sequence + trigger, per organisation), never by the browser. This was v1's biggest source of bugs.
- **Supabase CLI:** local dev, migrations in the repo, `supabase gen types`.
- **UI:**
  - Tailwind v4 + shadcn/ui (Radix), TanStack Table and Query, React Hook Form + Zod, Recharts, lucide-react, date-fns.
  - Design tokens from the Claude Design canvas.
- **Background work:** pg_cron + Supabase Edge Functions for reminders, overdue checks and auto check-out.
- **Notifications:** an in-app table with Realtime, Web Push and email.
- **AI assistant:** `@anthropic-ai/sdk`, model `claude-opus-5-5`.
  - Tools run with the signed-in user's session, so RLS applies.
  - Write tools only propose; the user confirms.
