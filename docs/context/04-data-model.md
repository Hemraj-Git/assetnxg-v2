# 04 · Data model

## v1 tables (one database per client)

From `reference/old-schema-baseline-0056.sql` plus 0057 and 0058. In v1, ids are `text`/uuid, and some dates are stored as text, both YYYY-MM-DD and older DD-MM-YYYY (see `parse_stored_date`).

| Table | Key columns |
|---|---|
| `profiles` | id (= auth user), email, full_name, role, department, phone |
| `departments` | name, code, description, head_user_id |
| `campuses` | name, code, address |
| `buildings` | campus_id, name, code, total_floors |
| `rooms` | building_id, name, room_number, type, floor, room_size_sqft, is_reservable, qr_code_key, status, current_occupant, last_printed_at |
| `room_types` | name (case-insensitive unique), created_by |
| `categories` | name, code, description |
| `sub_categories` | category_id, name, code, sla_priority, metadata_fields (json), pm_template_ids[], inspection_template_ids[] |
| `checklist_templates` | title, type (PM / Inspection), interval, items (json) |
| `assets` | asset_id (AST-), name, sub_category_id, room_id, manufacturer, model, serial, price, purchase_date, installation_date, last_serviced_date, warranty_till, maintenance_by, maintenance_vendor_id, amc_start/end_date, purchase_vendor_id, assigned_to_user_id, dynamic_specifications (json), image_url, notes, status, sla_priority, qr_code_url, last_printed_at |
| `asset_activity_logs` | asset_id, action, by_user, source (Manual / System / Bulk Import), remarks, reference_id, timestamp_epoch |
| `inventory_items` | inventory_number, name, sub_category_id, make/model/part/serial, quantity, min_stock_level, unit_cost, storage_location, room_id, vendor_id, purchase_date, warranty_till, dynamic_specifications, image_url, notes |
| `documents` | title, category, file_name/type/size, file_url, asset_id, inventory_item_id, uploaded_by_user_name |
| `vendors` | code, name, category_supplied, contact_person, email, phone, address, has_amc, amc_contract_no, amc_start/end_date |
| `service_requests` | ticket_id, title, description, type, priority, room_id, asset_id, status, requested_by_* (user_id, name, email, phone, role), sla_due_date, sla_hours, photo_urls, work_order_id/number/type, dismissal_reason/at/by, resolution_notes, assigned_to |
| `work_orders` | wo_number, type, title, asset_id, room_id, priority, source, source_ref_id, frequency, due_date, assigned_technician_id/name, status, checklist (template id, snapshot, responses), issue_logged, instructions, diagnosis, solution_taken, technician_remarks, parts_replaced (json), start/completion photo, executed_by, vendor_* (id, ticket_no, tech_name, tech_phone, service_date, job_sheet_url, remarks, cost), completed_at |
| `inspections` | inspection_number, asset_id, template_id, template_version, due_date, status, result, checklist snapshot/responses, remarks, instructions, conducted_by(_user_id), conducted_at, start_photo_url, photo_url, item_photos (json) |
| `outside_repairs` | repair_number, work_order_id, asset_id, scope, component_name, fault_description, sent_by, vendor_id, sent_date, expected_return_date, dispatch_ref, vendor_ref, estimated_cost, dispatch_photo_url, status, returned_date, outcome, actual_cost, return_remarks/photo, recorded_by, returned_by, overdue_notified_at |
| `reservations` | reservation_number, room_id, user_id, user_role, department_name, date, time_slot, slot_hour, purpose, status, group_booking_id |
| `room_access_logs` | room_id, user_id, user_name, user_role, purpose, check-in/out times and epochs, is_force_checkout, auto_checkout_note, activity_number, guest_email |
| `notifications` | user_id, type, title, body, ref_table, ref_id, is_read, pushed_at |
| `push_subscriptions` / `push_config` | per-device Web Push endpoints / VAPID keys (service role only) |
| `sla_settings` | priority, hours |

**Storage buckets:** evidence photos (`work-orders-evidence`), documents, asset and spare images. Public read by URL; owner-scoped write.

**Key DB functions:**
- numbering: `mint_work_order_number`, `set_service_request_ticket_id`, `set_inspection_number`;
- `schedule_asset_maintenance`, `next_schedule_date`, `work_order_follow_ups`, `inspection_follow_ups`, `skip_duplicate_follow_up`;
- `end_schedules_of_retired_asset`, `keep_templates_in_use`, `block_completion_with_open_outside_repairs`;
- `room_check_in` / `room_check_out` / `run_auto_checkouts`, `set_asset_status`;
- `limit_service_requests`, `set_service_request_sla`;
- the `notify_*` functions, `queue_push`, `register_push_subscription`;
- `qr_target_label`, `prevent_self_role_change`, `handle_new_user`, `is_admin` / `is_staff` / `current_user_role`.

**Scheduled jobs (pg_cron, UTC):**

| Job | When (IST) | Cron (UTC) |
|---|---|---|
| auto check-out | 23:59 | `29 18 * * *` |
| due-today reminders | 08:00 | `30 2 * * *` |
| outside-repair overdue | 09:00 | `30 3 * * *` |

## What changes in v2

1. **Organisations (multi-tenant).**
   - `organizations`: name, short name, subdomain/slug, logo, logo mark, locale, currency, time zone, settings json.
   - Every business table gets `organization_id` (not null, indexed), and every RLS policy checks it.
   - Unique constraints become `(organization_id, code)`.
   - Sequences/counters are **per organisation and type**: use a `counters` table with `(organization_id, kind, year)` and a function that increments it inside the insert trigger, rather than one global Postgres sequence. Numbers then restart per client.
2. **Memberships and permissions** replace `profiles.role`:
   - `memberships(user_id, organization_id, roles[] / permissions)`; a user can belong to more than one organisation (support logins).
   - Helper functions `current_org()`, `has_role(...)` and `has_permission(...)` are used in RLS, written as `(select ...)` so they evaluate once per query.
3. **Real types:** uuid ids, `date` / `timestamptz` columns (no text dates), numeric money, enums or check constraints for statuses.
4. **Stock movements** (new): every quantity change is a row (item, qty ±, reason, reference, balance, by, at). Covers receipts, issues, adjustments, deploy-to-asset and counts. Built in Phase 2 with `spares` (INV-#### from the DB, sub-category with its spec fields, min stock, unit cost, store room + shelf, supplier, purchase and warranty dates; Spares module): `stock_movements` (opening / received / issued / adjusted with the counted quantity / deployed with the asset), insert-only, the only way `spares.quantity` changes, never below 0. `deploy_spare()` creates the asset, records the movement, gives the asset the spare's documents and turns a running warranty into a warranty contract. A spare with history can't be deleted. Procurement adds receipts, material-request issues and counts.
5. **Generic audit log** (new): who did what, when, on which record, with before/after. Needed for ISO 9001 (procurement) and replaces ad-hoc logs where sensible. Keep `asset_activity_logs` as the asset timeline.
6. **Departments become a hierarchy** (owner, 17-11-2026; built in Phase 2):
   - `departments` adds `parent_id` (a department can sit under another; cycles refused by a trigger) and `active`. `head_user_id` must be an active member of the organisation and not a support login.
   - `memberships.department_id` replaces `profiles.department` (one department per person in each organisation).
   - `approval_delegations` (from_user, to_user, starts_on, ends_on, reason) covers an approver on leave.
   - "Head of department" comes from the department, not from a role. See `06-new-modules.md` §B, "Approvals and hierarchy".
7. **Warranty/AMC**: core `contracts` (vendor, kind, contract no., dates, cost, coverage, `renewed_from_id`, `not_renewing`) and `contract_assets` (contract ↔ asset, many-to-many), built with Assets. v1's vendor and asset AMC columns are not kept; the Warranty & AMC module adds reminders. See `06-new-modules.md` §A.
8. **Procurement tables**: see `06-new-modules.md`.
9. **Assistant**: `assistant_conversations`, `assistant_messages`, `assistant_actions` (proposed / confirmed / rejected, with payload and result).
10. **Documents** (built in Phase 2): `documents` (DOC-YYYY-#### from the DB, title, type Invoice / Warranty card / User guide / AMC contract / Other, file path, name, size and type taken from storage, `asset_ids`, `contract_ids` and `spare_ids` links). Files sit in a **private** bucket `documents` under `<organization id>/` (v1 was public by URL): staff of that client open them through one-minute signed links, only its Admins upload (browser → storage with a one-time signed upload link, up to 25 MB), and nothing is deleted through the API, so deleting a document removes the record and its links but keeps the file.
