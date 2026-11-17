# 05 · The redesign

## Where it is

- **Admin desktop: Claude Design canvas.** "AssetNXG Admin Redesign", https://claude.ai/artifact/1vkgjrgWg4M3KkLKfc2DE7 (private to the owner; open it in claude.ai). There are about 200 artboards on 3 pages:
  - **Phase 1 · Design system:**
    - read-me and design decisions, tokens (light and dark), type, icons, controls, feedback components;
    - client logo slot; app shell at 1440 / 1280 / 1024 / 768 / 390, light and dark;
    - header menus (command palette, create, notifications, avatar), data table pattern, drawer and dialog patterns, chart style board;
    - proof screen: work orders.
  - **Phase 2 · Operations:** dashboard, service requests, work orders, preventive, corrective, housekeeping, inspections, outside repairs, reservations, reports. Each has its drawers and dialogs, the 768 / 390 versions, empty/loading/error states, and Keep / Improve / Add / Hide notes.
  - **Phase 3 · Registry, setup and sign-in:** assets (list, bulk upload, page, wizard), spares, categories and sub-categories, locations, checklist templates, QR (choose → layout → preview → print, true A4 sheets), documents, vendors, people, sign-in pages. Also a developer handoff checklist.
- **The prompts that produced it:** "AssetNXG Admin Revamp Prompts", https://claude.ai/artifact/4GLryqfiSS1qnLFQrzAKP8 (shared brief and the three phase prompts).
- **Field app:** v1's current `/mobile` is already the redesigned light-theme field app (built from its own Claude Design canvas). Port its screens and behaviour, and re-skin it with v2 tokens if they differ.

**Visual direction (from the brief):**
- Calm, precise European B2B look: strict grid, small radii, 1px borders, colour used for meaning.
- Primary blue `#1D4ED8` (strong `#1E3A8A`, weak `#EAF0FE`).
- Meaning colours: housekeeping `#6D28D9`, inspection `#047857`, guest `#0F766E`, danger `#B91C1C`, warning `#B45309`, success `#15803D`.
- Type: IBM Plex Sans and Plex Mono (for IDs). Icons: lucide 1.5 px.
- No "generic AI" look.
- Charts animate in (bars grow, donuts sweep), morph on filter change, and respect reduced motion.

The canvas sometimes invents features. Treat it as **look and layout**. Rules come from `03-business-rules.md` and the owner.

## Gaps: in v1 but missing from the canvas (build them anyway, in the canvas style)

1. **Guest access** on the sign-in page (full name, email, mobile). The canvas shows staff sign-in only.
2. **Change password** in the account (avatar) menu.
3. **"Checked in: <room>" bar with Check out** in the header.
4. **Vendor job details** in the work order drawer: vendor, vendor ticket/job no., vendor technician name and phone, service visit date, job sheet photo, remarks, cost.
5. **Delete** for campus, building, room, category, sub-category, reservation and user. Refused while used, with a typed confirmation where irreversible.
6. **Resend invite** for "Invited" staff.
7. **Start cleaning** on housekeeping jobs from the desk (the canvas has only "Mark done").
8. **Room access log by date** with "View all" (the canvas shows the last 24 h only).

Minor: QR sheets should also **download as PDF** (the canvas only prints). Reports keep filters by asset and by user.

## Where the canvas contradicts v1 (resolved)

| Canvas says | Decision |
|---|---|
| "Guests don't sign in; guest records deleted after 30 days" | **Wrong.** Guests sign in via Guest access and are kept. Any retention policy is the client's decision; don't build auto-delete |
| Adds an **Inspector** role | **No new role** unless the owner asks. Any staff member can be assigned an inspection |

## Canvas extras: not in v1, NOT approved yet (hide until the owner decides)

- Downtime per asset needs breakdown start and end recorded. MTTR and the repeat-failure flag can be computed from existing data; **those are fine**.
- Repair cost as quoted / approved / final.
- Vendor overdue reminders and escalation.
- Template archive, deactivating vendors, and review of field-added vendors.
- Logging who viewed a contact's details.
- Bulk-add rooms; a service request "came from" (QR / desk / field app); dismiss with a message to the requester.
- Drag to create a booking; housekeeping repeat days and booking check.
- Report schedule by email (the canvas itself marks it "planned").

**Approved front-end additions** (built from existing data, no new rules): board and calendar views, the room timeline for reservations, the room-by-day housekeeping board, the dashboard "Needs attention" strip and animated charts with period and campus filters, saved views, column chooser, bulk assign, pass-rate and "PM done on time" metrics, tree views for categories and locations, one combined checklist templates page with phone preview, the QR print wizard, report library with favourites, Excel and PDF export, dark theme, and the sign-in show-password and Caps Lock warning.

**Procurement and stock-movement screens** are not on the canvas. Design them in the same system (tables, drawers, dialogs, steppers, status chips).
