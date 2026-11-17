# 03 · Business rules (port these)

Each rule names where v1 enforces it: the migration number in `reference/` or the v1 file. In v2, **enforce rules in the database** (constraints, triggers, RLS, functions) wherever they must hold whoever saves, and mirror them in the UI only to explain them up front. v1 learned this the hard way (see `07-lessons.md`).

## 1. Numbers and codes

All are human-readable, unique and unchangeable once given. In v2 they are **per organisation** and made by the database.

| Thing | Format | Made by (v1) | Notes |
|---|---|---|---|
| Campus / Building / Room / Department | CAM-####, BLD-####, ROM-####, DEP-#### | DB unique constraints (0007, 0012); value from the app | v2: DB |
| Category | 4-letter code from the name (Electrical → ELEC) | app (`idGenerator.ts`) | unique |
| Sub-category | CAT-SUBC (ELEC-LIGH) | app | unique |
| Asset | AST-#### (bulk import continues from the highest) | app | v2: DB sequence |
| Spare | INV-#### | app | |
| Vendor | VND-#### | app (0011) | |
| Document | DOC-YYYY-#### | app | |
| Service request | SR-YYYY-#### | **DB trigger** (0014, IST year 0021) | |
| Inspection | INSP-YYYY-#### | **DB trigger** | |
| Preventive / corrective work order | WO-PM-YYYY-####, WO-CR-YYYY-#### | **DB** | `PENDING-<id>` until a technician is assigned; numbered on first assignment (0014), or on insert when created already assigned (0058) |
| Housekeeping work order | WO-HK-YYYY-#### | **app (browser)**, a known weakness | v2: DB, like the others |
| Reservation | RSV-YYYY-#### | app | |
| Outside repair | OSR-YYYY-#### | DB (0043) | |
| Room access (check-in) | AL-A#### | DB sequence (0038) | |

- The year in a number is the **IST** year (0021).
- Shown "Pending Assignment" (never the placeholder) while a job has no number. A service request linked to such a job shows "Pending Assignment" too.
- Each Preventive and Corrective sequence is shared between "assign" and "create assigned", so the two can never clash (0058).

## 2. Assets and schedules

- **Installation date** is locked once the asset exists. It anchors age and warranty, and is the default first date of schedules.
- **Last serviced date** (optional, for legacy assets) is used instead of installation as the base for the first job, so an old asset doesn't start overdue (0008).
- **SLA priority** belongs to each asset (0042). A request's priority is locked to the asset's; if the asset has none, the sub-category's; if neither, the requester chooses (`assetSlaPriority.ts`).
- **Schedules (0053)**
  - An asset can run several schedules (e.g. a Monthly and a Quarterly PM), never the same template twice.
  - An Admin adds a schedule to one or many assets (max 500 per call), with the date of the first job.
  - **The first date can't be changed afterwards.** It defaults to the installation date if still ahead, else today, and must be at most 2 years ahead (`firstSchedule.ts`).
  - "Not scheduled" = the asset's sub-category has a PM or inspection template the asset isn't running.
- **Follow-ups are made by the database on save, whoever saves (0050):**
  - A completed **preventive** job creates the next one: due = **date actually done + template interval**, so a late job doesn't push every later cycle back. It carries the same template, frequency, asset and priority, status Scheduled, number PENDING.
  - A completed **inspection** creates the next inspection the same way.
  - A **failed inspection** creates a **corrective** job, unassigned, source "Failed Inspection", linked to the inspection.
  - A **one-off** preventive job (no frequency or template) creates nothing (0053).
  - The same follow-up is never created twice (a guard drops duplicates before numbering).
- **Asset status follows the work (0050):**
  - In Progress → Under Maintenance.
  - Completed → Operational.
  - A corrective job's first assignment → Under Maintenance.
  - None of these change an asset that is **Retired** or **In Storage**.
- **Retiring an asset (0053):**
  - its preventive jobs not yet started are cancelled;
  - its inspections not yet started are removed;
  - work already under way finishes, but schedules nothing after it.
- **Templates in use:** a checklist template can't be deleted while a job or schedule uses it (0053).
- **Checklist snapshot:** a job copies its template's items when created, so later template edits don't change open jobs. Inspections keep `template_version`.

## 3. Attempt window ("Can start from"), for preventive jobs and inspections

A scheduled job can't be started or completed before its window opens (`reference/attemptWindow.ts`):

| Interval | Window opens |
|---|---|
| Weekly | 1 day before due |
| Monthly | 7 days before due |
| Quarterly (and unknown) | 15 days before due |
| Half-Yearly | 1 month before due |
| Annually | 2 months before due |

The field app shows the job locked until then. v1 checks this in the app; **v2 should also enforce it in the DB.**

## 4. Overdue

A work order is overdue when its due date is past and it is not Completed or Cancelled. A job with no due date is never overdue (`isWorkOrderOverdue.ts`). Inspections: due date past and not Completed.

## 5. Service requests and SLA

- **Types:** Maintenance or Housekeeping (the form). The data also allows Cleaning, IT Support, General.
- **Priority:** Critical / High / Medium / Low.
- **SLA hours** (0055):
  - an organisation setting per priority, defaults 4 / 12 / 24 / 48 h; only Admins change it;
  - a new request's deadline = **DB time now + hours for its priority**, and the hours are kept on the request;
  - changing the setting never alters existing requests, nor the work orders made from them.
- **Status flow:**
  - **Open**: raised.
  - **In Progress**: a work order made from it gets its technician/number. The request is stamped with the job number, and shows "Pending Assignment" before that.
  - **Resolved**: that work order is completed (v1 cascade in `updateWorkOrderStatus`; the assignee may update the request, 0024).
  - **Closed**: dismissed by an Admin with a reason ("closed without a job").
  - **Escalated**: "raised to a supervisor for urgent attention". The status exists, but v1 has no automatic escalation. **Decide in v2** (e.g. SLA breach → Escalated).
- **Requester is told** (in-app and push, 0051): resolved, escalated, closed (with the reason).
- **Requester identity** is stamped from the real session, never from the form. The role is kept on the request (`set_requester_role`).
- **Rate limit** (0054): at most 5 requests an hour as a guest, 30 an hour as staff; Admins unlimited. `created_at` is set by the DB.
- **Equipment:** only the chosen room's assets; required when the room has any.

## 6. Work orders

- **Types:** Preventive, Corrective, Housekeeping.
- **Sources** ("Came from"): Scheduled, Service Request, Failed Inspection, Routine.
- **Statuses:** Scheduled → In Progress → Completed, or Cancelled.
  - `completed_at` is stamped only on the transition into Completed.
  - Completing twice must not create follow-ups twice.
- **Fields the office writes:** `issue_logged` (the issue as reported, or the scope); `instructions` (to the field, shown on the phone; 0052).
- **Fields the technician writes:** `diagnosis` ("Problem found"), `solution_taken`, `technician_remarks`, `parts_replaced` (list), start and completion photos, checklist responses (per item: value, remarks, photo).
- **Closing:**
  - preventive needs the completion photo;
  - a breakdown needs the solution;
  - mandatory checklist items and required photos must be done.
- **Done by: Vendor** (vendor handover, 0039):
  - the technician records vendor, vendor ticket no., vendor technician name and phone, service date, job sheet photo, remarks and cost;
  - Admins are notified once when a job switches to Vendor while still open;
  - vendors have no login, so the assigned technician supervises the job and records on their behalf.
- **Outside repairs (0043):**
  - each send-out is one row tied to the work order; only Admins and that job's technician see or record them;
  - **a work order can't be completed while anything is still out**;
  - Admins are alerted when something is sent out, and once when its expected return date passes (09:00 IST check).
- **Assignment notifications:** the assignee gets "work assigned" or "inspection assigned" (in-app and push).
- **Assign-to lists:** people who can sign in first. Invite-pending people are shown but not selectable. Support logins are never listed.

## 7. Housekeeping

- Routine cleaning uses a **fixed 5-item room checklist** (`reference/housekeeping.ts`), not a template. The items are saved as the job's checklist snapshot.
- A clean-up made from a request shows the request and before/after photos instead.
- The redesign adds "warn when the room is booked at that time". This is new and is a nice-to-have.

## 8. Inspections

- Statuses Scheduled → In Progress → Completed. Result Pass / Fail / Not Applicable.
- Assign an inspector with instructions. Any staff member can inspect; there is no Inspector role.
- **Field flow:** start photo on arrival → checkpoints (Pass/Fail, "What is wrong" on Fail, photo where required) → remarks → end photo → submit.
- **Fail** → corrective job (rule 2). **Compliance score** = passed ÷ completed; none completed → "—", never 100%.

## 9. Rooms, check-in and reservations

- **Check-in/out** go through DB functions (`room_check_in` / `room_check_out`), never direct table writes:
  - each check-in has a purpose and an activity number;
  - room status becomes Occupied with the current occupant, and returns to Available at check-out.
  - A guest's open check-in is found by email across visits (0041).
- **Auto check-out** at **23:59 IST** for anything still open (pg_cron, 0006): marked forced, with a note and a notification.
- The **access log** is the audit trail. Guests can read only their own entries.
- **Reservations:**
  - only reservable rooms; one-hour slots (`slot_hour`);
  - **no two bookings for the same room, date and slot**;
  - **no past date, nor a slot already started today** (IST);
  - a multi-date / multi-slot booking is one insert, all or none (`group_booking_id`).
  - Statuses Confirmed / Completed / Cancelled.

## 10. Spares

- Low stock: quantity ≤ minimum threshold (default 2 when unset); 0 = out of stock.
- **Deploy as asset** creates an asset (which can start schedules), moves the spare's documents to it, and reduces quantity by 1. v1 deletes the spare at 0; v2 should keep it with 0 stock.
- v1 keeps **no stock movement history**. v2 adds it (see procurement).

## 11. People, accounts and security

- **Invite only:**
  - the invite and reset links last as set in Supabase (`EMAIL_LINK_VALID_HOURS`);
  - until a password is set, the person can only reach the set-password page;
  - "Invite pending" = invited and never signed in (`accountState.ts`).
- **Password rules:** as set in Supabase Auth (minimum length plus lower, upper, digit and symbol). The screens show a live checklist (`authPolicy.ts`). Changing a password needs the current one, and an old session must re-authenticate.
- **Roles are never self-chosen** (0028, 0045, 0048, 0049):
  - a trigger blocks changing your own role;
  - sign-up metadata can't set a role; self-registration becomes Guest;
  - an Admin's invite carries the role through a trusted path.
- **Guests** (0026, 0027, 0054):
  - an anonymous account per visit; email is reused across visits and is unique only among staff;
  - guests read only their own rows, plus earlier requests **raised by guests** with the same email;
  - they may upload photos (evidence bucket) but not documents;
  - they never read vendors, documents, spares, departments, templates, asset history or reservations;
  - **signed-out QR scans** see only a name and code (`qr_target_label`).
- **RLS everywhere:**
  - Admin has everything;
  - technicians, housekeepers and inspectors see and update their own assigned jobs and inspections;
  - requesters see their own requests; staff read reference data.
  - In v2, every policy is **also** scoped by organisation.
- **Storage:** no public write; uploads by signed-in users only, owner-scoped select and update (0030, 0031); no deletes through the API.
- **Trigger-only functions** are not callable through the API (0032).
- **Department head** is a registered user. Deleting that user clears the link.
- **Support logins** (`@assetnxg.app`) are hidden from every client-facing list (0057 touches this too).

## 12. Notifications and push

- **One `notifications` table:** user, type, title, body, reference (table and id), read flag. Rows are **inserted by the server only** (triggers and cron).
- **Types:** `wo_assigned`, `inspection_assigned`, `auto_checkout`, `vendor_handover`, `outside_repair_sent`, `outside_repair_overdue`, `request_resolved`, `request_escalated`, `request_closed`, `due_today`.
- **Web Push** (0044):
  - every new notification row, and every new service request (to Admins), is queued and sent by the `send-push` Edge Function through pg_net;
  - VAPID keys are self-generated on first use and kept in a service-role-only table;
  - subscriptions are per device, with a failure count.
- Test runs (titles starting "[E2E]") never push (0046).
- **Sound:** a chime on new alerts once the browser allows audio (after the first tap).

## Index: every v1 migration and where its rule lives in this pack

| v1 migration | Rule | Here |
|---|---|---|
| 0002 service_requests_fix | request columns as the app uses them | 04 |
| 0003 profiles_guest_auth | guests sign in anonymously; profile made by `handle_new_user` | 11 |
| 0004 role_scoped_rls_and_notifications | own jobs/requests only by RLS; server-inserted notifications | 11, 12 |
| 0005 admin_scoped_reference_tables | only Admins write reference data | 11 |
| 0006 server_side_auto_checkout | 23:59 IST auto check-out | 9 |
| 0007 unique_taxonomy_codes | unique codes | 1 |
| 0008 asset_last_serviced_date | first job from last serviced date | 2 |
| 0009 documents_inventory_item_link | documents link to spares too; moved on deploy | 10, 04 |
| 0010 inventory_items_missing_columns | spare fields saved | 04, lesson 6 |
| 0011 vendor_code | VND-#### | 1 |
| 0012 unique_room_number | ROM- unique | 1 |
| 0013 access_log_activity_number | AL-A#### | 1 |
| 0014 server_side_ticket_numbering | DB numbering | 1, lesson 1 |
| 0015 / 0016 room_self_service_checkin | check-in via DB functions | 9 |
| 0017 / 0018 / 0020 check-out timestamps and force params | real timestamps; auto check-out through the same function | 9, lesson 5 |
| 0019 asset_activity_log_epoch | real timestamps | lesson 5 |
| 0021 numbering_ist_year | IST year in IDs | 1 |
| 0022 date_schema_hardening | real date types | lesson 5 |
| 0023 set_asset_status_rpc | status changes via function | 2 |
| 0024 service_request_assignee_update | assignee can update the linked request | 5 |
| 0025 wo_inspection_photos_and_vendor_fields | photos, parts, vendor fields saved | 6 |
| 0026 / 0027 guest email | guest email reuse; history by email | 11 |
| 0028 prevent_self_role_change | no self role change | 11 |
| 0029 profiles / access-log read scoping | guests read only their own | 11 |
| 0030 / 0031 storage | no public write; owner-scoped | 11 |
| 0032 revoke trigger function execute | trigger functions not callable | 11 |
| 0033 / 0034 / 0036 / 0040 realtime | live tables; initplan RLS | 02 (background), lesson 12 |
| 0035 department_head | head = a registered user | 11 |
| 0037 asset_activity_reference | timeline reference numbers | 02 |
| 0038 server_side_activity_numbers | AL numbers from the DB | 1 |
| 0039 vendor_handover_notification | Admins told on vendor handover | 6 |
| 0041 guest_checkin_by_email | guest's open check-in across visits | 9 |
| 0042 asset_sla_priority | priority per asset | 2 |
| 0043 outside_repairs | outside repairs | 6 |
| 0044 web_push | push pipeline | 12 |
| 0045 / 0048 / 0049 sign-up role hardening | role never self-chosen; self sign-up = Guest | 11 |
| 0046 no_push_for_e2e | no push for test runs | 12 |
| 0047 drop_anonymous_write_policies | no writes without sign-in | 11 |
| 0050 completion_follow_ups | follow-ups and asset status in the DB | 2 |
| 0051 requester_updates_and_due_today | requester told; 08:00 due-today | 5, 12 |
| 0052 field_feedback | instructions and diagnosis fields; field-added vendor | 6 |
| 0053 asset_schedules | schedules, retire, templates in use | 2 |
| 0054 guest_scope_and_rate_limits | guest scope; request rate limit; QR label only | 5, 11 |
| 0055 sla_settings | SLA hours in DB | 5 |
| 0056 room_types | one room-type list | 02 |
| 0057 no_default_department | no default department; support logins | 11 |
| 0058 number_work_orders_created_assigned | WO created assigned is numbered by the DB | 1 |
