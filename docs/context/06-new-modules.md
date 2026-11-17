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

**Source:** `procurement/SoMSQP PRO 01 2026.pdf` (the owner adds it). Built to sections **5.1–5.11**, **configurable per organisation**, so other clients can use their own steps, with SoMS as the first template.

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

### Cross-cutting

- **Roles / permissions** (per membership, combinable): Procurement Manager, Procurement Executive, HOD (department head; v1 already stores `head_user_id`), Accounts, Director/Principal (Dean), Building Security Supervisor, Store In-charge.
- **Audit trail** of every step (who, when, remarks), for ISO 9001 (§9).
- **Files by year and category** (§7.1); retention periods per record type as settings (§7: e.g. PO 8 years, requisition 5 years).
- **KPIs** (§8): registered vendors and changes (annual); urgent requisitions (monthly); urgent closure ≤ 48 h; non-conformities.
- **Non-conformity flags** (§9.2), raised automatically: PO issued without approval, goods received without a delivery note, vendor not approved.
- **Numbers:** requisition, quote, PO, receipt, invoice, material request. Made by the DB with a per-organisation format (SoMS uses its FL codes).

### Tables (sketch)

- `vendor_registrations`, `vendor_evaluations`, `vendor_feedback`
- `requisitions`, `requisition_items`, `approvals` (generic: entity, step, approver, decision, remarks, at)
- `quotations`, `quotation_items`
- `purchase_orders`, `po_items`, `goods_receipts`, `receipt_items`
- `invoices`, `payments`, `material_requests`, `material_request_items`
- `stock_movements`, `stock_counts`, `stock_count_lines`
- `procurement_settings` (DoFA bands, minimum quotes, number formats, retention, reminder offsets)
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
