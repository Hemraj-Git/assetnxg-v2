"use client";

import { useActionState, useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, CircleCheck, Clock, Eye, Mail, Pencil, TriangleAlert, UserMinus, UserPlus, Users, X } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { TableMessage } from "@/components/data-table/table-message";
import { Avatar } from "@/components/shell/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DetailDrawer,
  DrawerBody,
  DrawerFacts,
  DrawerFooter,
  DrawerHeader,
  DrawerSection,
} from "@/components/ui/detail-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CheckboxRow, FormMessage, SelectField, TextField } from "@/components/ui/field";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDate } from "@/lib/dates";
import { ROLE_LABELS, roleSummary, type RoleGroup } from "@/lib/roles";
import type { TableParams } from "@/lib/table-params";
import {
  addStandIn,
  invitePerson,
  removePerson,
  removeStandIn,
  resendInvite,
  updatePerson,
  type ActionState,
} from "./actions";
import { PEOPLE_TABLE, type PersonRow, type StandIn } from "./people-table";

type DepartmentOption = { id: string; path: string };
type StaffOption = { userId: string; name: string; email: string };

const initial: ActionState = { error: null, success: null };

function Status({ person }: { person: PersonRow }) {
  return person.pending ? (
    <StatusChip tone="warning" icon={Clock}>
      Invite pending
    </StatusChip>
  ) : (
    <StatusChip tone="success" icon={CircleCheck}>
      Active
    </StatusChip>
  );
}

export function PeopleView({
  rows,
  total,
  params,
  everyone,
  departments,
  roleGroups,
  timeZone,
  staff,
  hasDirector,
}: {
  rows: PersonRow[];
  total: number;
  params: TableParams;
  /** People in the organisation before any search. */
  everyone: number;
  departments: DepartmentOption[];
  roleGroups: RoleGroup[];
  timeZone: string;
  /** Everyone on the staff (all pages), for the stand-in picker. */
  staff: StaffOption[];
  /** Someone holds the Director / Principal role (the top of the hierarchy). */
  hasDirector: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [standInFor, setStandInFor] = useState<PersonRow | null>(null);
  const [notice, setNotice] = useState<ActionState>(initial);
  const [busy, startTransition] = useTransition();

  const index = rows.findIndex((r) => r.membershipId === openId);
  const open = index >= 0 ? rows[index] : null;
  const editing = rows.find((r) => r.membershipId === editId) ?? null;
  const removing = rows.find((r) => r.membershipId === removeId) ?? null;

  const columns: ColumnDef<PersonRow, unknown>[] = [
    {
      id: "name",
      header: "Name",
      meta: { priority: 0 },
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={row.original.name} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {row.original.name}
              {row.original.isMe && <span className="font-normal text-text-3"> (you)</span>}
            </span>
            <span className="truncate text-small text-text-3">{row.original.email}</span>
          </span>
        </span>
      ),
    },
    {
      id: "roles",
      header: "Roles",
      meta: { priority: 1 },
      cell: ({ row }) => <span className="block max-w-[280px] truncate text-text-2">{roleSummary(row.original.roles)}</span>,
    },
    {
      id: "department",
      header: "Department",
      meta: { priority: 2 },
      cell: ({ row }) => (
        <span className="block max-w-[260px] truncate text-text-2">{row.original.departmentPath ?? "—"}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      meta: { priority: 1 },
      cell: ({ row }) => <Status person={row.original} />,
    },
    {
      id: "added",
      header: "Added",
      meta: { priority: 3 },
      cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.addedAt, timeZone)}</span>,
    },
  ];

  function run(task: () => Promise<ActionState>, after?: () => void) {
    startTransition(async () => {
      const result = await task();
      setNotice(result);
      if (!result.error) after?.();
    });
  }

  return (
    <>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      <DataTable
        id="people"
        noun={{ one: "person", many: "people" }}
        columns={columns}
        rows={rows}
        total={total}
        getRowId={(r) => r.membershipId}
        params={params}
        defaults={PEOPLE_TABLE}
        searchPlaceholder="Search by name, email, role or department"
        openRowId={openId}
        onOpenRow={(r) => setOpenId((cur) => (cur === r.membershipId ? null : r.membershipId))}
        toolbar={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus aria-hidden /> Invite person
          </Button>
        }
        rowMenu={(r) => (
          <>
            <DropdownMenuItem onSelect={() => setOpenId(r.membershipId)}>
              <Eye aria-hidden /> Open details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditId(r.membershipId)}>
              <Pencil aria-hidden /> Edit roles and department
            </DropdownMenuItem>
            {r.pending && (
              <DropdownMenuItem onSelect={() => run(() => resendInvite(r.userId))}>
                <Mail aria-hidden /> Resend invite
              </DropdownMenuItem>
            )}
            {!r.isMe && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setRemoveId(r.membershipId)}>
                  <UserMinus aria-hidden /> Remove from organisation…
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
        renderCard={(r) => (
          <span className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{r.name}</span>
              <span className="truncate text-small text-text-3">{r.email}</span>
            </span>
            <Status person={r} />
            <span className="col-span-2 truncate text-small text-text-2">
              {roleSummary(r.roles)}
              {r.departmentPath ? ` · ${r.departmentPath}` : ""}
            </span>
          </span>
        )}
        empty={
          everyone === 0 ? (
            <TableMessage
              icon={Users}
              actions={
                <Button onClick={() => setInviteOpen(true)}>
                  <UserPlus aria-hidden /> Invite person
                </Button>
              }
            >
              No one here yet. Invite the people who will use AssetNXG.
            </TableMessage>
          ) : undefined
        }
      />

      <DetailDrawer open={open !== null} onOpenChange={(o) => !o && setOpenId(null)} width={480}>
        {open && (
          <>
            <DrawerHeader
              title={open.isMe ? `${open.name} (you)` : open.name}
              chips={<Status person={open} />}
              actions={
                <>
                  <Button onClick={() => setEditId(open.membershipId)}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                  {open.pending && (
                    <Button variant="secondary" loading={busy} onClick={() => run(() => resendInvite(open.userId))}>
                      <Mail aria-hidden /> Resend invite
                    </Button>
                  )}
                  {!open.isMe && (
                    <Button variant="ghost" onClick={() => setRemoveId(open.membershipId)}>
                      <UserMinus aria-hidden /> Remove
                    </Button>
                  )}
                </>
              }
            />
            <DrawerBody>
              <DrawerSection title="Contact">
                <DrawerFacts
                  items={[
                    { label: "Email", value: open.email },
                    { label: "Phone", value: open.phone || "—" },
                  ]}
                />
              </DrawerSection>
              <DrawerSection title="In this organisation">
                <DrawerFacts
                  items={[
                    { label: "Roles", value: roleSummary(open.roles) },
                    { label: "Department", value: open.departmentPath ?? "—" },
                    { label: "Head of", value: open.heads.length ? open.heads.join("; ") : "—" },
                    { label: "Added", value: formatDate(open.addedAt, timeZone) },
                    {
                      label: "First signed in",
                      value: open.firstSignedInAt ? formatDate(open.firstSignedInAt, timeZone) : "Not yet",
                    },
                  ]}
                />
              </DrawerSection>
              <DrawerSection title="Approvals">
                <ApprovalFacts
                  person={open}
                  hasDirector={hasDirector}
                  timeZone={timeZone}
                  busy={busy}
                  onAdd={() => setStandInFor(open)}
                  onRemove={(id) => run(() => removeStandIn(id))}
                />
              </DrawerSection>
              <p className="text-small text-text-3">
                Name and phone are changed by the person, from their account menu.
              </p>
            </DrawerBody>
            <DrawerFooter
              position={`${index + 1} of ${rows.length} on this page`}
              onPrevious={index > 0 ? () => setOpenId(rows[index - 1].membershipId) : undefined}
              onNext={index < rows.length - 1 ? () => setOpenId(rows[index + 1].membershipId) : undefined}
            />
          </>
        )}
      </DetailDrawer>

      {/* Mounted only while open, so each invite starts with a clean form. */}
      {inviteOpen && (
        <InviteDialog
          onOpenChange={setInviteOpen}
          departments={departments}
          roleGroups={roleGroups}
          onDone={(message) => {
            setInviteOpen(false);
            setNotice({ error: null, success: message });
          }}
        />
      )}

      {editing && (
        <EditDialog
          key={editing.membershipId}
          person={editing}
          departments={departments}
          roleGroups={roleGroups}
          onOpenChange={(o) => !o && setEditId(null)}
          onDone={(message) => {
            setEditId(null);
            setNotice({ error: null, success: message });
          }}
        />
      )}

      {standInFor && (
        <StandInDialog
          person={standInFor}
          staff={staff.filter((p) => p.userId !== standInFor.userId)}
          onOpenChange={(o) => !o && setStandInFor(null)}
          onDone={(message) => {
            setStandInFor(null);
            setNotice({ error: null, success: message });
          }}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title={`Remove ${removing?.name ?? "this person"}?`}
        description="They can no longer sign in to this organisation. Their past work stays on record. You can invite them again later."
        confirmLabel="Remove"
        pending={busy}
        onConfirm={() => {
          const id = removeId;
          if (!id) return;
          run(
            () => removePerson(id),
            () => {
              setRemoveId(null);
              if (openId === id) setOpenId(null);
            },
          );
        }}
      />
    </>
  );
}

// ───────────── Invite ─────────────

function InviteDialog({
  onOpenChange,
  departments,
  roleGroups,
  onDone,
}: {
  onOpenChange: (open: boolean) => void;
  departments: DepartmentOption[];
  roleGroups: RoleGroup[];
  onDone: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await invitePerson(prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initial);

  return (
    <Dialog open onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="md">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">Invite a person</DialogTitle>
            <DialogDescription>
              They get an email to choose a password. Someone who already uses AssetNXG can sign in straight away.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <TextField label="Email" name="email" type="email" autoComplete="off" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Full name" name="full_name" autoComplete="off" required />
              <TextField label="Mobile number" name="phone" type="tel" autoComplete="off" optional />
            </div>
            <DepartmentSelect departments={departments} />
            <RolePicker roleGroups={roleGroups} />
            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Edit ─────────────

function EditDialog({
  person,
  departments,
  roleGroups,
  onOpenChange,
  onDone,
}: {
  person: PersonRow;
  departments: DepartmentOption[];
  roleGroups: RoleGroup[];
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await updatePerson(person.membershipId, prev, formData);
    if (result.success) onDone(`${person.name}: ${result.success.toLowerCase()}`);
    return result;
  }, initial);

  const offered = new Set(roleGroups.flatMap((g) => g.roles.map((r) => r.role)));
  const hidden = person.roles.filter((r) => !offered.has(r));

  return (
    <Dialog open onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="md">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">Edit {person.name}</DialogTitle>
            <DialogDescription>{person.email}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <DepartmentSelect departments={departments} defaultValue={person.departmentId ?? ""} />
            {person.isMe ? (
              <p className="text-small text-text-2">
                Your roles: {roleSummary(person.roles)}. You can&apos;t change your own roles; ask another Admin.
              </p>
            ) : (
              <>
                <RolePicker roleGroups={roleGroups} selected={person.roles} />
                {hidden.length > 0 && (
                  <p className="text-small text-text-3">
                    Also kept: {hidden.map((r) => ROLE_LABELS[r]).join(", ")} (for a module that is switched off).
                  </p>
                )}
              </>
            )}
            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Approvals ─────────────

function StandInLine({ s, timeZone }: { s: StandIn; timeZone: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span>
        <span className="font-medium">{s.otherName}</span>, {formatDate(s.startsOn, timeZone)} to{" "}
        {formatDate(s.endsOn, timeZone)}
        {s.activeToday && <span className="text-text-3"> (now)</span>}
      </span>
      {s.reason && <span className="text-small text-text-3">{s.reason}</span>}
    </span>
  );
}

function ApprovalFacts({
  person,
  hasDirector,
  timeZone,
  busy,
  onAdd,
  onRemove,
}: {
  person: PersonRow;
  hasDirector: boolean;
  timeZone: string;
  busy: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const approval = person.approval;
  return (
    <div className="flex flex-col gap-4 text-cell">
      <div className="flex flex-col gap-1">
        <span className="text-small text-text-3">Their requisitions go first to</span>
        <span>{approval ? approval.note : "—"}</span>
        {approval?.toDirectorRole && !hasDirector && (
          <span className="flex items-start gap-1.5 text-small text-warning-ink">
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 flex-none" />
            No one has the Director / Principal role yet. Give it to someone, or set a head for their department.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-small text-text-3">Stand-ins while they are away</span>
        {person.standIns.length === 0 ? (
          <span className="text-text-2">None</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {person.standIns.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-2">
                <StandInLine s={s} timeZone={timeZone} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={"Remove stand-in " + s.otherName}
                  disabled={busy}
                  onClick={() => onRemove(s.id)}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button variant="secondary" size="sm" onClick={onAdd}>
            <CalendarClock aria-hidden /> Add a stand-in
          </Button>
        </div>
      </div>

      {person.standingInFor.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-small text-text-3">They stand in for</span>
          <ul className="flex flex-col gap-2">
            {person.standingInFor.map((s) => (
              <li key={s.id}>
                <StandInLine s={s} timeZone={timeZone} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StandInDialog({
  person,
  staff,
  onOpenChange,
  onDone,
}: {
  person: PersonRow;
  staff: StaffOption[];
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await addStandIn(person.userId, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initial);

  return (
    <Dialog open onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="md">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">Stand-in for {person.name}</DialogTitle>
            <DialogDescription>
              Between these dates, approvals that would go to {person.name} go to the stand-in instead. A
              stand-in never approves their own requisitions, and a head&apos;s own requisitions still go up.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <SelectField
              label="Stand-in"
              name="to_user_id"
              defaultValue=""
              options={[
                { value: "", label: "Choose a person" },
                ...staff.map((p) => ({ value: p.userId, label: p.name + " · " + p.email })),
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="First day" name="starts_on" placeholder="DD-MM-YYYY" inputMode="numeric" autoComplete="off" />
              <TextField label="Last day" name="ends_on" placeholder="DD-MM-YYYY" inputMode="numeric" autoComplete="off" />
            </div>
            <TextField label="Reason" name="reason" optional maxLength={200} placeholder="e.g. On leave" />
            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Add stand-in
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Shared fields ─────────────

function DepartmentSelect({ departments, defaultValue = "" }: { departments: DepartmentOption[]; defaultValue?: string }) {
  return (
    <SelectField
      label="Department"
      name="department_id"
      defaultValue={defaultValue}
      options={[{ value: "", label: "No department" }, ...departments.map((d) => ({ value: d.id, label: d.path }))]}
      help={
        departments.length === 0
          ? "Add departments on the Departments tab."
          : "Their requisitions go to this department's head for approval."
      }
    />
  );
}

function RolePicker({ roleGroups, selected = [] }: { roleGroups: RoleGroup[]; selected?: readonly string[] }) {
  return (
    <div className="flex flex-col gap-3">
      {roleGroups.map((group) => (
        <fieldset key={group.label} className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] leading-[18px] font-medium">{group.label}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {group.roles.map((r) => (
              <CheckboxRow
                key={r.role}
                name="roles"
                value={r.role}
                title={ROLE_LABELS[r.role]}
                description={r.description}
                defaultChecked={selected.includes(r.role)}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
