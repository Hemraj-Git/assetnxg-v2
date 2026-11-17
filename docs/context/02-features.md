# 02 · Features in v1 (everything v2 must keep)

Built from v1's pages, dialogs and buttons (33 admin pages plus the field app). The redesign changes the look; it must not lose any of these. Items marked **(gap)** are missing from the Claude Design canvas and must be added (see `05-design.md`).

## Shell (desktop)

- **Sidebar**, 23 links in 7 groups:
  - Main: Dashboard
  - Organization: Campus, Building/Block, Rooms/Areas
  - Asset Management: Assets, Inventory/Spares, Categories, Sub-Categories
  - Operation: Service Requests, Reservations, Inspection
  - Maintenance: Work Orders, Preventive, Corrective, Housekeeping, Outside Repairs
  - Reports
  - Utility: QR Codes, Document Library, Vendors, Maintenance Templates, Inspection Templates
  - Admin: Users
- Collapsible to icons; a mobile drawer under 1024 px.
- **Header:**
  - global search (Ctrl/⌘ K): assets, rooms, work orders, requests, people, vendors;
  - notifications bell with panel (mark read, dismiss, link to item);
  - sound toggle; push-alerts toggle; Help & support (copy support email); About;
  - **Change password (gap)**;
  - **"Checked in: <room>" bar with Check out (gap)**: shown when the signed-in person has an open room check-in;
  - "Field Mode" link; role pill; sign out.
- Data-load failure banner with **Retry**. Toasts with error details. Confirm dialogs for destructive actions.

## Dashboard

- Banner for new service requests waiting for assignment, which can be hidden here only.
- KPIs: open service requests, PM due, inspections pending, rooms reserved today, items out for repair.
- Asset status distribution; **Compliance score** (passed ÷ completed inspections; "—" with none).
- Upcoming preventive maintenance list; open service requests list.

## Organization

- **Campuses, Buildings/Blocks, Rooms/Areas.** Each has list, add, edit and **delete (gap)**; delete is refused while something depends on it. Codes are automatic and unchangeable (CAM-, BLD-, ROM-####).
- **Room types:** one shared list. Admins add types, and can remove a type no room uses ("Classroom" = "classroom").
- **Room page:**
  - room information; assets in the room (link to each); today's reservations; QR code; Print label;
  - **Access log**: tamper-evident QR check-in/out with activity numbers AL-A####, filter by date and **View all (gap)**; Edit room.

## Assets

- **List:**
  - search and filters (campus, building, room, category, sub-category, status), reset filters;
  - **Bulk upload**: download an Excel template pre-filled with the masters, upload, row-level validation, import, summary.
- **Add / edit asset**, a 5-step wizard:
  1. Basic info: name, category, sub-category, SLA priority, manufacturer, model, serial, price, purchase date, **installation date** (locked after creation), last serviced date (for legacy assets), warranty till, maintained by In-house/Vendor (AMC vendor and dates), purchased-from vendor with **inline "Add new vendor"**, assigned user, notes, image.
  2. Location: campus → building → room.
  3. Specifications: the sub-category's custom fields.
  4. Documents: attach from the library or **upload new inline**.
  5. Review: summary plus PM and inspection schedule rows, each with its own first date and "+ Add PM / + Add inspection", and a confirmation listing the first dates.
- **Asset page:**
  - header with ID, name, status; KPI cards (next maintenance, last inspection, asset age);
  - **PM & inspection schedule** card: running schedules with next date; templates of its sub-category "Not scheduled"; **Add a schedule** (PM or inspection, template, first date from installation, today or a picked date; warning that first dates can't change);
  - tabs: Basic info, Specifications, Maintenance history, **Outside repairs**, Inspection log, Linked documents, Activity timeline (each event with its reference number);
  - image; QR code; Print label; Edit.
- Statuses: Operational, Under Maintenance, In Storage, Retired. Retiring ends the asset's schedules (see rules).

## Spares (Inventory Hub)

- **List:** stock with low-stock marking, search, filters, view, edit, delete.
- **Adjust stock quantity** dialog.
- **Deploy spare as active asset**: creates an asset, carries specs and documents, reduces stock.
- **Add spare**, a 4-step wizard: item and stock info, custom specifications, documents (inline upload), review. Includes inline add vendor.
- **Spare page:** specifications, sub-category specs, photo, documents, storage and handling notes, supplier and purchase info, adjust, deploy.

## Taxonomy

- **Categories:** add, edit, delete (refused while used). Codes are automatic (4 letters, e.g. ELEC).
- **Sub-categories**, a 5-step wizard:
  1. Basic info (incl. default SLA priority).
  2. Metadata field builder (label, type Text/Number/Date, unit, required, order).
  3. PM templates.
  4. Inspection templates.
  5. Review and publish.

  Templates can be created inline. After templates are added to a sub-category that has assets, it asks "Schedule existing assets? Now / Later". Edit and delete.

## Checklist templates (PM and inspection; two pages in v1)

- Title, description, interval (Weekly, Monthly, Quarterly, Half-Yearly, Annually).
- Items: text, instructions, response type (Checkbox, Pass-Fail, Yes-No, Numeric, Text), mandatory, photo required, order.
- Delete is refused while a schedule or open job uses the template.

## Service requests (desk)

- **List:** status tabs; search; overdue/SLA indication.
- **Create:** type Maintenance or Housekeeping; room; equipment (only that room's assets, required when the room has any); priority **locked** from the asset's SLA priority (fallback: sub-category's, then the requester chooses); title (optional); description (required); optional photo.
- **Details drawer:** description, photos, requester and role, timeline, linked work order. Actions:
  - create a work order (Corrective or Housekeeping);
  - assign;
  - **Dismiss** with a reason, which closes it without a job and notifies the requester.
- **Configure SLA hours** per priority (Critical/High/Medium/Low; defaults 4/12/24/48 h). Applies to new requests only.

## Work orders (hub) and the three type pages

- **Work Orders:** tabs All, Preventive, Corrective, Housekeeping with KPI cards; overdue filter; **Create Work Order** (type, title, asset, room, technician, priority, due date, issue); details drawer.
- **Preventive:**
  - table of next PM job per asset schedule; Assign technician; details drawer;
  - **"Not scheduled"** banner and panel (assets whose sub-category has PM templates but no schedule): tick assets, start "from today" or a picked date, review the warning, result "N scheduled, M skipped" with reasons, or Later.
- **Corrective:** breakdown queue; assign; details drawer; **Log breakdown resolution** (problem found optional, solution required, parts used list) → "Complete & return to service"; Reassign.
- **Housekeeping:**
  - Schedule housekeeping (room, date, staff); assign staff; **Start cleaning (gap in design)** and mark complete from the desk;
  - routine jobs use the fixed 5-step room checklist; jobs made from a request show the request and before/after photos.
- **Work order details drawer**, in this order:
  - assigned technician; asset, room, source ("Came from"), priority, due date, "Can start from" (attempt window), "Done by" (In-house / Vendor);
  - **From the office**: scope and instructions to the field;
  - **Recorded so far by <technician>**: start and completion photos; checklist with Done / Not done and each step's note and photo; problem found; solution taken; parts used; technician notes ("Not recorded" when empty);
  - **vendor job details (gap)**: vendor, vendor ticket/job no., vendor technician name and phone, service visit date, job sheet photo, vendor remarks, cost;
  - outside-repair panel; Resolve and Reassign.

## Inspections

- Table; assign inspector, with instructions shown on their phone; Perform/Conduct inspection (desk); View details.
- **Report drawer:** instructions, remarks ("Not recorded"), photos at start and end, each checkpoint PASS / FAIL (with "What is wrong") / Not answered.
- "Not scheduled" panel as for Preventive.
- A failed inspection creates a corrective job automatically.

## Outside repairs

- Register of parts or whole assets sent to vendors (OSR-YYYY-####): scope (Component / Complete asset), component, fault, sent by (Technician / Vendor), vendor, sent date, expected return, dispatch ref (gate pass / challan), vendor's job no., estimated cost, dispatch photo.
- **Return:** date, outcome (Repaired / Replaced by vendor / Not repairable), actual cost, remarks, photo.
- Overdue status. Started from a corrective job ("+ Send outside for repair").

## Reservations

- Day grid (rooms × hour slots) with previous/next day and Today; list.
- **Book:** room, purpose, one or many dates and slots in one booking (all or none), conflict check (same room, date, slot), past slots refused.
- Statuses Confirmed / Completed / Cancelled; **delete reservation (gap)**.

## Documents

- Library: upload (title, type Invoice/Warranty/User Guide/AMC Contract/Other, file); filters and search; download; link to assets or spares.

## Vendors

- List; add/edit (name, category supplied, contact person, email, phone, address, AMC yes/no with contract no. and dates); code VND-####.
- Delete is refused while linked to assets or spares. Technicians can add a repair vendor from the phone.

## QR codes

- Room placards (PDF, 4 per A4, client logo) and asset labels (5 × 5 cm grid PDF).
- Select many, print; a "last printed" date is kept.
- QR URLs resolve through `/qr` → the field app's room or asset screen.

## Reports (11, each a filterable table with Export CSV and Print/PDF, refresh)

Asset master · Location-wise summary · Room-wise assets · Room access & activity · Warranty & AMC · Preventive maintenance · Corrective maintenance · Inspections · Service requests · Technician workload · Inventory spares. Filters include dates, location, asset and user. Technician workload shows no technician ID.

## People (Users)

- **Staff directory:**
  - **invite user** (email, name, role, department, phone): an email link to set a password; "Invite pending" until first sign-in; **resend invite (gap)**;
  - edit user (role, department, phone); delete user; view user.
- **Guests list:** grouped by email, with their requests.
- **Departments:** add, edit, delete (refused while users are linked); head of department = a registered user.

## Sign-in and account

- **Login:**
  - "Staff sign in" (email + password) and **"Guest access" (full name, email, mobile number) (gap: the design shows staff only)**;
  - the QR target's name shown when arriving from a scan.
- Forgot password (email link); Set password with a live password checklist; "This link has expired" page; Change password (desktop dialog and field app sheet).

## Field app (`/mobile`)

- **Tasks** (Technician):
  - list with filters (open / done, overdue first, then urgency); "Due today", "Overdue by 2 days" wording;
  - PM jobs locked until their attempt window opens.
- **Job screen:**
  - start photo; checklist (per-step done/not done, note, photo where required); problem found; solution taken (required to close a breakdown); parts used;
  - **hand over to vendor** (vendor fields above; can add a new vendor); **send outside for repair** and record the return;
  - completion photo (required for preventive); complete.
- **Cleaning** (Housekeeping): routine 5-step checklist, or a clean-up from a request with before/after photos; start and complete.
- **Inspections:** start photo; checkpoints Pass/Fail with "What is wrong" and photo where required; remarks; end photo; submit.
- **Requests:**
  - my requests (a guest's earlier visits are matched by email); progress (Raised → Handed to team → Being worked on → Resolved / Escalated / Closed);
  - deadline line ("Due in 2 h 32 m", "Overdue by 6 h");
  - **New request** (as the desk form; priority locked from the asset) → success screen.
- **Scan:**
  - QR viewfinder or pick from a list;
  - **room screen**: check in with purpose, check out; assets in the room; raise a request; open-check-in "Active in: <room>" bar;
  - **asset screen**: details, raise a request.
- **Notifications** screen. **Profile:** change password, alerts on/off (Web Push), sound, sign out.
- Works as a PWA; one-handed, outdoor use.

## Background behaviour (no screen, but users rely on it)

- **Auto check-out** at 23:59 IST for anyone still checked in, with a notification.
- **Morning reminder** at 08:00 IST: each technician or inspector gets one list of their PM jobs and inspections due today.
- Outside repair **overdue alert** at 09:00 IST (once per repair).
- **Push alerts:**
  - work assigned, inspection assigned, vendor handover, outside repair sent or overdue, auto check-out;
  - to the requester: request resolved, escalated or closed;
  - to Admins: every new service request.
- **Live updates** (Realtime): work orders, inspections, service requests, notifications, rooms, access logs, assets and their timeline.
