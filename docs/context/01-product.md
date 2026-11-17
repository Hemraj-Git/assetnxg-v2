# 01 · The product

## What it is

AssetNXG is a CAFM/CMMS for institutes. The first clients are maritime training institutes, with campuses, academic blocks, hostels, bridge and engine simulators, classrooms and labs. It manages:

- **Locations:** campus → building/block → room or operational area. Rooms have a type, floor, size and QR code, can be reservable, and have a live occupancy status.
- **Assets:** a category → sub-category taxonomy, with custom specification fields per sub-category. Each asset has a location, vendor, warranty, AMC, SLA priority, status and QR code.
- **Spares / inventory:** stock, minimum threshold, storage location. A spare can be deployed as an asset.
- **Maintenance:**
  - preventive (scheduled from checklist templates), corrective (breakdowns), housekeeping (cleaning);
  - inspections (statutory and quality checklists, Pass/Fail);
  - outside repairs (parts or whole assets sent to a vendor's workshop).
- **Service requests:** anyone, including guests who scan a room's QR code, reports a problem. The office turns it into a work order, and an SLA clock runs.
- **Reservations:** booking rooms by hour slot.
- **Documents:** invoices, warranty cards, manuals, AMC contracts, linked to assets or spares.
- **Vendors, people and departments, reports, QR labels and placards.**
- **Notifications:** in-app, sound, Web Push to phones and desktops.

v2 adds **warranty/AMC reminders**, **procurement** and an **AI assistant** (see `06-new-modules.md`).

## Two apps in one

| | Desktop admin | Field app (`/mobile`, PWA) |
|---|---|---|
| Who | Admin (facility manager, maintenance office) | Technician, Housekeeping, Faculty, Guest |
| What | Set up, plan, assign, watch SLAs, report | Do the work: jobs, cleaning, inspections, requests, QR scan, room check-in/out |
| Rule | Admins do not use the field app; non-Admins never reach desktop pages | |

Field app tabs per role: Scan is always in the centre.

| Role | Tabs | Opens on |
|---|---|---|
| Technician | Tasks, Inspections, Requests, Profile | Tasks |
| Housekeeping | Cleaning, Inspections, Requests, Profile | Cleaning |
| Faculty | Inspections, Requests, Profile | Inspections |
| Guest | Requests, Profile | Scan |

Inspections can be assigned to any staff member (Technician, Housekeeping, Faculty). There is **no separate "Inspector" role**. The redesign shows one; the owner has not asked for it.

## Roles in v1

`Admin`, `Faculty`, `Technician`, `Housekeeping`, `Guest`.

- Staff are **invited** by an Admin: an email link lets them set a password. They show as "Invite pending" until first sign-in.
- **Guests** sign in on the "Guest access" tab with name, email and mobile number, usually after scanning a room's QR code. Each guest visit is a new anonymous account; a returning guest sees earlier requests matched by email. A staff email is refused on guest sign-in.
- A person can never choose or change their own role. Self-registration becomes Guest.

v2 adds procurement roles (see `06-new-modules.md` §B): Procurement Manager, Procurement Executive, Accounts, Director/Principal, Dean, Building Security Supervisor, Store In-charge and Quality Manager. These are **permissions on a membership**, and one person can hold several.

**Head of department is not a role** (owner, 17-11-2026). It is the person set as head on a department. Departments can sit under other departments, and approvals go up that hierarchy. The old `hod` role value stays in the database but is hidden from role pickers.

## White-label

- Each client's name and logo lead the brand: the top of the sidebar, the sign-in page, print headers, QR placards. Logos come as a wide one and a square mark, with a text fallback when there is none.
- "Powered by AssetNXG" appears quietly in the sidebar footer, About/Help, the browser tab ("Assets · AssetNXG"), and the footer of printed reports and QR sheets.
- v1 sets the brand by build-time env vars per deployment, one Vercel project per client at `<short>.assetnxg.app` (SoMS: `soms.assetnxg.app`, PMS: `pms.assetnxg.app`). **In v2 the brand is organisation data**: name, short name, logo, logo mark, colours if needed, locale and currency.
- Support logins (`@assetnxg.app`, e.g. `admin@assetnxg.app`) work on every client but are never shown to clients.
- Help shows `support@assetnxg.app` and, in About, "A product of HMS Digital Solutions".

## Locale and standards

- Dates on screen **DD-MM-YYYY**; ISO in exports. Times in 24 h; the field app uses friendly forms ("Due today", "Overdue by 2 days").
- **Asia/Kolkata** for "today", cron times, and the year baked into IDs.
- Currency ₹ (organisation setting), Indian number grouping by default.
- The redesign brief targets WCAG 2.2 AA (EU Accessibility Act), GDPR-style data minimisation (contact details hidden in lists), and light and dark themes.

## Clients today

| Client | v1 deployment | Notes |
|---|---|---|
| SoMS (School of Maritime Studies, Centurion University) | soms.assetnxg.app, from `afms-app` main | First client; its procurement procedure drives the v2 module |
| PMS | pms.assetnxg.app, from `afms-pms` (a release copy) | Same code, own Supabase project |

Both stay on v1 (fixes only) until v2 is ready, then move (see `08-client-migration.md`).
