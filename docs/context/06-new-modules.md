# 06 · New modules in v2

## A. Warranty and AMC reminders

**Why:** v1 stores `warranty_till` (assets, spares) and AMC dates (assets, vendors) but never warns anyone. Expiries are found only by running the Warranty & AMC report.

**What:**
- **Contracts.** Each warranty or AMC is a record: asset (or spare), type (Warranty / AMC / Extended warranty), vendor, contract no., start, end, cost, coverage notes, document. An asset can have a history of them.
  - v1's single `warranty_till` and `amc_*` columns migrate into the first contract.
- **Reminders.**
  - A daily pg_cron job at 08:00 IST finds contracts ending in **90, 60, 30, 7 and 0 days**. The offsets are an organisation setting.
  - It sends in-app, push and email alerts to Admins, plus the asset's assigned user if set. Each offset is sent once per contract.
  - Expired contracts show as "Expired" until renewed or marked "Not renewing".
- **Screens:**
  - dashboard "Expiring soon" panel;
  - asset page warranty/AMC panel with a days-left countdown;
  - **Renew** action: a new contract carrying the vendor forward, with the new dates and document;
  - the Warranty & AMC report uses contracts.
- **Procurement link:** goods received as equipment (see B, 5.8) can be registered as an asset with its warranty already filled in.

## B. Procurement (SoMS procedure SOMSQP-PRO-01, Issue 02, 06-07-2026)

**Source:** `procurement/SoMSQP PRO 01 2026.pdf` (shared 17-11-2026; summary in `procurement/README.md`). Built to sections **5.1–5.11**, **configurable per organisation**, so other clients can use their own steps, with SoMS as the first template.

### Step by step

| § | Procedure | In the app | Record · statuses |
|---|---|---|---|
| 5.1 | Department identifies a need | **Requisition**: department, requester, items (description, specs, qty, est. cost), justification. Starts from: manual entry; low stock (5.9); parts needed on a work order; a store request that can't be filled (5.11) | FL1 · Draft → Submitted |
| 5.2 | Vendor selection; registration for regular providers; approved for one year | Vendor **registration** (company, capabilities, compliance docs: FL2) and **approved-until** date (one year). Only approved vendors can quote. Significant purchases get a quality-review flag (Director / Principal / PM) | FL2 · Pending → Approved → Renewal due → Discontinued |
| 5.3 | Feedback on each receipt; annual evaluation 1–5; a 1 means discontinued | **Feedback** at goods receipt (FL3). **Annual evaluation** prompted near approved-until (FL4). Score 1 → Discontinued, which blocks quotes and POs | FL3, FL4 |
| 5.4 | At least 2 quotations; check match; compare and negotiate | **Quotations** per requisition (vendor, items, prices, delivery, terms, file). Side-by-side comparison, "matches spec" tick, chosen quote with reason. PO blocked with fewer than the minimum quotes (setting, SoMS: 2) unless urgent | Quotes on FL1 |
| 5.5 | HOD → PM → Accounts per DoFA | **Approval chain**, each step logged with approver, time and remarks. Rejection returns it with a reason | Submitted → HOD approved → PM reviewed → Quoted → Accounts approved → (Director approved) → Approved / Rejected |
| 5.6 | Urgent requisition | **Urgent** flag with eligibility (critical item / Dean-or-Director request), urgency, impact, approving authority, the single vendor and justification (FL10). Goes straight to Dean/Director; one quote allowed. **Monthly urgent review** list; the same item recurring is flagged "report to Quality Manager (CASE log)". KPI: closure within 48 h | FL10 |
| 5.7 | PO after approval; copies to Principal and Head of Accounts; vendor acknowledges | **Purchase order** from the approved requisition and chosen quote. Number in the organisation's format (SoMS: `SOMSQP-PRO-01-FL5-PO-2026-v1`); PDF with T&C. Emailed to the vendor, copied to Principal and Head of Accounts. Vendor **acknowledgement** recorded (date / ref) | FL5 · Draft → Issued → Acknowledged → Part received → Received → Closed |
| 5.8 | Exec + requisitioner + Building Security Supervisor check against requisition, PO and invoice; delivery note, manual, warranty; Exec signs; feedback | **Goods receipt** per line: received / accepted / rejected qty, condition, checks by the three roles, delivery note / manual / warranty uploaded, Exec sign-off (FL6), feedback (FL3). Partial deliveries allowed. **Equipment → register as asset** (with warranty, feeding A) | FL6 + FL3 |
| 5.9 | Update stock; thresholds; monthly physical verification; consumption report | Receipt adds **stock movements**. Below threshold → draft requisition. **Monthly stock count** (counted vs system, adjustments with reason). **Consumption report**. Stock register (FL8), asset register (FL9) | FL8, FL9 |
| 5.10 | Check the invoice against PO/quote; tell the vendor of shortfalls; Accounts pays | **Invoice** with **three-way match** (PO ↔ receipt ↔ invoice), mismatches highlighted, "shortcoming sent to vendor" note. Forwarded to Accounts, who record **payment** (date, mode, ref, amount) | Received → Mismatch / Verified → Forwarded → Paid |
| 5.11 | Material request; store issues and closes | **Material request** (FL7) from a department or technician. Store In-charge issues (stock-out movement) and closes. Not in stock → one click raises a requisition | FL7 · Open → Issued / Part issued → Closed |

### Decisions (owner, 16-11-2026)

- **DoFA limits** are an organisation setting (approval levels with amount bands). Build now; the values come later from the DoFA policy.
- **No budgets in v1 of procurement.** Accounts approves against DoFA only, with no "budgeted / non-budgeted" categorisation and no balance check.
- **Order of steps:** HOD approves the need → PM reviews → Executive collects ≥2 quotes and picks one → Accounts approves that amount → Director if above the DoFA limit → PO.
- **No vendor logins.** Staff record vendor registration, quotes, acknowledgement and invoices with the vendor's files. Vendors get the PO by email.

### Decisions (owner, 17-11-2026)

- **DoFA bands are configurable** per organisation ("Who approves what" settings). No code change is needed when the values arrive.
- **The step order is confirmed:** HOD → Procurement Manager review → Executive collects quotes → Accounts → Director above the DoFA limit → PO.
- **Hierarchy = departments with heads, nested.** A person belongs to one department. There's no per-person "reports to".
- **Requester heads their own department, or the department has no head:** the approval goes **up** to the parent department's head. At the top, it goes to the Director / Principal.
- **New roles:** Dean and Quality Manager.

### Roles

Roles are per membership and combinable.

| In the procedure | In AssetNXG | Can do |
|---|---|---|
| Requisitioner (§5.1) | Any member with a department | Raise requisitions and material requests; track their own; join the receipt check (§5.8) |
| Department Head (HOD) | **The head of a department**: set on the department, not a role (`hod` stays in the enum, hidden from pickers) | Approve their department's requisitions (and sub-departments' when escalated); see their department's requisitions |
| Procurement Manager | `procurement_manager` | Review step; approve vendor registrations and evaluations (FL2, FL4); monthly urgent review (§5.6.3); all procurement records |
| Procurement Executive | `procurement_executive` | Quotes, chosen quote, PO (FL5), receipt sign-off (FL6), feedback (FL3), invoice check (§5.10), stock |
| Accounts Team | `accounts` | Spend approval per DoFA; payments |
| Director / Principal | `director` | High-value approval; urgent approval; quality review of significant purchases |
| Dean | `dean` (new) | Urgent approval with the Director (§5.6.2); can sit in DoFA bands |
| Building Security Supervisor | `security_supervisor` | Receipt check (§5.8) |
| Store In-charge | `store_incharge` | Issues against material requests (FL7); monthly stock count (FL8) |
| Quality Manager / Head of Compliance | `quality_manager` (new) | Non-conformity flags (§9.2), recurring-urgent alerts (§5.6.3), KPI page (§8); read-only on procurement records |
| Principal, Head of Accounts (PO copies, §5.7) | Setting: **PO copy recipients** | Get the PO email copy |

### Approvals and hierarchy

**Department hierarchy** (built in Phase 2 with People):
- `departments.parent_id`, with a trigger that refuses cycles.
- `head_user_id` must be an active member and not a support login.
- `memberships.department_id`.
- `approval_delegations` (from, to, start and end dates in IST, reason) covers an approver on leave.
- `private.resolve_department_approver(dept, requester)`:
  1. Walk up from the requester's department to the first head who is set, active and not the requester.
  2. Use their delegate if one is active today, unless the delegate is the requester. A head's own requisition always goes up, even while someone stands in for them (built 18-11-2026; tests in `supabase/tests/approval_hierarchy.sql`).
  3. Past the top, go to the `director` role.
  4. Record a plain note, e.g. "Sent to the head of Academics because the requester heads Marine Engineering".

**"Who approves what"** (settings, Admin only, every change in `audit_log`):
- `approval_steps`: route (standard / urgent), stage (need / spend), position, label, approver (department head / role), roles (any of), amount_from, amount_to, active.
- A step applies when the amount is in `[amount_from, amount_to)`; empty means no limit. That covers both cumulative DoFA (Accounts always, plus Director above ₹X) and exclusive bands (Dean ₹1L–5L, Director above ₹5L).
- Need-stage amount = the requisition's estimate. Spend-stage amount = the chosen quote's total, with tax by default (setting).
- The screen lists the steps and shows a live band preview: "Up to ₹1,00,000: HOD → PM → Accounts · Above ₹1,00,000: … → Director".
- **SoMS template:**
  - Standard, need: HOD → Procurement Manager.
  - Standard, spend: Accounts → Director (above the DoFA limit).
  - Urgent: Dean or Director; minimum quotes 1; FL10 fields required.
  - Until the DoFA values arrive, the Director step has no lower limit (over-approve, never under-approve).

**Running an approval:**
- `approvals` rows (generic `entity_table`, `entity_id`) are a **snapshot** taken when a stage starts, so editing settings never changes requests in flight.
- **Submit** creates the need-stage rows. **Need approved** puts the request in the Executive's queue. **The chosen quote** (≥ minimum quotes unless urgent) creates the spend-stage rows. **All approved** allows a PO; a trigger refuses a PO before that. **An amount change** after approval restarts the spend stage.
- `decide_approval(id, approve | send_back | reject, remarks)` checks:
  - the caller is the assignee, their active delegate, or holds the step's role;
  - the caller is **never the requester**;
  - nobody approves two steps of the same request (setting, default on). If no one else is eligible, it says so plainly.
  - Remarks are required to send back or reject. Send back returns the request to the requester to edit and resubmit. Reject closes it.
- New notification types: `approval_requested`, `approval_returned`, `approval_rejected` and `requisition_approved`. A reminder follows after N days (setting). Urgent requests show the 48 h clock.
- Who sees a requisition:
  - the requester;
  - the heads of its department and of every department above it;
  - Procurement Manager, Procurement Executive, Accounts, Director, Dean and Quality Manager;
  - anyone with a pending approval on it.

### Cross-cutting

- **Roles / permissions:** see "Roles" above.
- **Audit trail** of every step (who, when, remarks), for ISO 9001 (§9).
- **Files by year and category** (§7.1); retention periods per record type as settings (§7: e.g. PO 8 years, requisition 5 years).
- **KPIs** (§8): registered vendors and changes (annual); urgent requisitions (monthly); urgent closure ≤ 48 h; non-conformities.
- **Non-conformity flags** (§9.2), raised automatically: PO issued without approval, goods received without a delivery note, vendor not approved.
- **Numbers:** requisition, quote, PO, receipt, invoice, material request. Made by the DB with a per-organisation format (SoMS uses its FL codes).

### Tables (sketch)

- `vendor_registrations`, `vendor_evaluations`, `vendor_feedback`
- `requisitions`, `requisition_items`, `approvals` (generic snapshot rows: entity, stage, position, approver, assignee, status, decided by/at, remarks, route note)
- `approval_steps` ("Who approves what" settings); `approval_delegations` and the `departments` hierarchy (Phase 2)
- `quotations`, `quotation_items`
- `purchase_orders`, `po_items`, `goods_receipts`, `receipt_items`
- `invoices`, `payments`, `material_requests`, `material_request_items`
- `stock_movements`, `stock_counts`, `stock_count_lines`
- `procurement_settings` (minimum quotes, amount-includes-tax, one-approval-per-person, PO copy recipients, number formats, retention, reminder offsets)
- `non_conformities`

## C. AI assistant ("Ask AssetNXG")

**Scope v1 (owner's choice):** answers questions from the user's own data, and **proposes actions that the user confirms** before anything is saved.

**UX:**
- A chat panel in the admin app (later the field app), with answers streamed.
- Answers link to records (WO-…, AST-…).
- A proposed action shows as a card (what will be created or changed, with the fields) with **Confirm** / **Edit** / **Cancel**.

**How:**
- A server Route Handler uses `@anthropic-ai/sdk` with model **`claude-opus-5-5`**, adaptive thinking, and effort `medium`; tune it later.
  - The SDK **Tool Runner** (`client.beta.messages.toolRunner` with `betaZodTool`) drives the loop.
  - It streams to the browser.
  - Server-side refusal fallbacks are on (`fallbacks: "default"` with the server-side-fallback beta).
  - Validate every tool input with Zod.
- **Prompt caching:** keep the system prompt and tool list fixed and first (cache breakpoint). Per-request facts (user, org, today's IST date) go after it, never inside the cached part.
- **Security: tools run with the signed-in user's Supabase session (server client from cookies), so RLS limits the assistant to exactly what that user may see.** Never the service-role key.
- **Read tools:**
  - search assets / rooms / people / vendors;
  - get work orders / requests / inspections with filters (overdue, unassigned, due this week);
  - asset history; warranty/AMC status; stock levels; procurement status;
  - report summaries.
- **Write tools never write:**
  - they return a **proposed action** (type + validated payload), stored in `assistant_actions` as `proposed`;
  - Confirm calls the **same Server Action the normal screen uses**, so the same validation and RLS apply, then marks the action `confirmed` with the result;
  - examples: raise a service request, create / assign a work order, schedule PM, draft a requisition.
- **Logging:** conversations, messages and actions are stored per organisation and user. Usage (tokens) is logged for cost tracking.
- `ANTHROPIC_API_KEY` lives in env/Vercel only.
