# AssetNXG v2: context pack

This folder carries everything known about AssetNXG v1 (the live app) into the v2 build, which starts in a new repository, a new Supabase project and a new Claude Code conversation. It was prepared from v1's code (`afms-app`, main at 29a0ea1, November 2026), its 58 database migrations, its user manual, the Claude Design redesign, and the product owner's decisions.

## Reading order

| # | File | What it gives you |
|---|---|---|
| 1 | `01-product.md` | What AssetNXG is, who uses it, white-label, roles, locale, how clients are run |
| 2 | `02-features.md` | Every v1 module, page, dialog and action (admin desktop and field app) |
| 3 | `03-business-rules.md` | The rules v1 enforces: numbering, statuses, schedules, SLA, cascades, security. **Port these; don't reinvent them** |
| 4 | `04-data-model.md` | v1 tables, triggers, functions, scheduled jobs, and what changes in v2 (multi-tenant) |
| 5 | `05-design.md` | The redesign (Claude Design canvas), its gaps against v1, and how they are resolved |
| 6 | `06-new-modules.md` | New in v2: warranty and AMC reminders, procurement (SoMS procedure SOMSQP-PRO-01), the AI assistant |
| 7 | `07-lessons.md` | Mistakes v1 made and fixed. Don't repeat them |
| 8 | `08-client-migration.md` | How the live clients (SoMS, PMS) move to v2 later |

**Reference material** (read when a file above points to it):
- `reference/old-schema-baseline-0056.sql`, `0057_*.sql`, `0058_*.sql`: v1's complete schema. Read it for rules and triggers; **don't apply it**, since v2 is multi-tenant.
- `reference/old-types-afms.ts`: v1's TypeScript domain types.
- `reference/attemptWindow.ts`, `housekeeping.ts`, `idGenerator.ts`: small v1 rule modules worth porting.
- `reference/old-send-push-edge-function.ts`: v1's Web Push Edge Function (self-generated VAPID keys).
- `manual/*.html`: v1's user manual (admin guide, field guide, getting started, quick cards). Good for wording and flows.
- `procurement/`: SoMS's procurement procedure (SOMSQP-PRO-01, Issue 02). The PDF and a summary of it are in this folder.

**Sources of truth, in order:**
1. The product owner.
2. These files.
3. The design canvas (for look and layout only, not for rules).
4. v1 code, if the v1 repository is available.

## Kickoff prompt (paste into the first v2 conversation)

> This is AssetNXG v2, a fresh build of an existing product. Read CLAUDE.md and every file in docs/context/ first (00-README.md gives the order); they describe the current product, its business rules, data model, the redesign and the new modules. Then propose the Phase 0 setup plan (Next.js 16 + Supabase with @supabase/ssr, multi-tenant RLS, shadcn/ui), before writing any code.

## Build order (agreed)

0. Set up the project: Next.js, Supabase CLI and shadcn. Then auth, organisations and memberships (roles), and the RLS pattern.
1. Design system and app shell (canvas Phase 1).
2. Core data: locations, categories and sub-categories, checklist templates, assets, spares, vendors, documents, people. People includes the **department hierarchy** (nested departments with heads, approval delegations) and the Dean and Quality Manager roles, so procurement approvals have them ready (`06-new-modules.md` §B).
3. Operations (canvas Phase 2): service requests, work orders, PM and inspection schedules, housekeeping, outside repairs, reservations, notifications, reports.
4. Field app (`/mobile`), ported from v1's current field app.
5. New modules: warranty and AMC reminders, then procurement, then the AI assistant.
6. Migration of SoMS and PMS data (see `08-client-migration.md`).
