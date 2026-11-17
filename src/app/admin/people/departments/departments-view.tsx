"use client";

import { useActionState, useState, useTransition } from "react";
import { Building, CornerDownRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { TableMessage } from "@/components/data-table/table-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import { departmentTree, parentChoices } from "@/lib/departments";
import { formatCount } from "@/lib/table-params";
import { deleteDepartment, saveDepartment, type ActionState } from "../actions";
import type { DepartmentRow } from "../people-table";

type PersonOption = { userId: string; name: string; email: string; pending: boolean };

/** null = closed; id null = new (optionally under a parent). */
type Editing = { id: string | null; parentId: string | null } | null;

const initial: ActionState = { error: null, success: null };

export function DepartmentsView({ departments, people }: { departments: DepartmentRow[]; people: PersonOption[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionState>(initial);
  const [busy, startTransition] = useTransition();

  const tree = departmentTree(departments);
  const deleting = departments.find((d) => d.id === deleteId) ?? null;
  const childCount = (id: string) => departments.filter((d) => d.parentId === id).length;

  return (
    <>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-small text-text-2">
          A requisition goes to the head of the requester&apos;s department. If they head it themselves, or it has
          no head, it goes to the department above.
        </p>
        <Button onClick={() => setEditing({ id: null, parentId: null })}>
          <Plus aria-hidden /> Add department
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        {tree.length === 0 ? (
          <TableMessage
            icon={Building}
            actions={
              <Button onClick={() => setEditing({ id: null, parentId: null })}>
                <Plus aria-hidden /> Add department
              </Button>
            }
          >
            No departments yet. Add them, then put each under the one it reports to.
          </TableMessage>
        ) : (
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-cell">
            <thead>
              <tr>
                {["Department", "Head", "People", ""].map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={`border-b border-border bg-surface px-4 py-2.5 text-[12.5px] font-medium text-text-2 ${
                      h === "People" ? "text-right" : "text-left"
                    } ${h === "" ? "w-12" : ""}`}
                  >
                    {h || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tree.map((d) => (
                <tr key={d.id} className="hover:bg-sunken">
                  <th scope="row" className="border-b border-border px-4 py-2.5 text-left font-normal">
                    <span className="flex items-start gap-2" style={{ paddingLeft: `${d.depth * 24}px` }}>
                      {d.depth > 0 && <CornerDownRight aria-hidden className="mt-0.5 size-4 flex-none text-text-3" />}
                      <span className="flex min-w-0 flex-col">
                        <button
                          type="button"
                          onClick={() => setEditing({ id: d.id, parentId: d.parentId })}
                          className="w-fit text-left font-medium hover:underline"
                        >
                          {d.name}
                        </button>
                        <span className="text-small text-text-3">
                          <span className="id">{d.code}</span>
                          {d.description ? ` · ${d.description}` : ""}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="border-b border-border px-4 py-2.5 text-text-2">
                    {d.headName ?? <span className="text-text-3">No head: goes to the department above</span>}
                  </td>
                  <td className="border-b border-border px-4 py-2.5 text-right tabular-nums">{formatCount(d.peopleCount)}</td>
                  <td className="border-b border-border px-2 py-1.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.name}`}>
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing({ id: d.id, parentId: d.parentId })}>
                          <Pencil aria-hidden /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEditing({ id: null, parentId: d.id })}>
                          <Plus aria-hidden /> Add a department under it
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleteId(d.id)}>
                          <Trash2 aria-hidden /> Delete…
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <DepartmentDialog
          key={`${editing.id ?? "new"}-${editing.parentId ?? ""}`}
          department={editing.id ? (departments.find((d) => d.id === editing.id) ?? null) : null}
          defaultParentId={editing.parentId}
          departments={departments}
          people={people}
          onOpenChange={(o) => !o && setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setNotice({ error: null, success: message });
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={`Delete ${deleting?.name ?? "this department"}?`}
        description={
          deleting && (deleting.peopleCount > 0 || childCount(deleting.id) > 0)
            ? "It still has people or departments under it. Move them first, or the delete is refused."
            : "This can't be undone."
        }
        confirmLabel="Delete department"
        typeToConfirm={deleting?.code}
        pending={busy}
        onConfirm={() => {
          const id = deleteId;
          if (!id) return;
          startTransition(async () => {
            const result = await deleteDepartment(id);
            setNotice(result);
            setDeleteId(null);
          });
        }}
      />
    </>
  );
}

function DepartmentDialog({
  department,
  defaultParentId,
  departments,
  people,
  onOpenChange,
  onDone,
}: {
  department: DepartmentRow | null;
  defaultParentId: string | null;
  departments: DepartmentRow[];
  people: PersonOption[];
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveDepartment(department?.id ?? null, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initial);

  const nodes = departments.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId }));
  const parents = parentChoices(nodes, department?.id ?? null);

  return (
    <Dialog open onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="md">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">{department ? `Edit ${department.name}` : "Add department"}</DialogTitle>
            <DialogDescription>
              {department ? department.code : "The number (DEP-…) is given when you save."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <TextField label="Name" name="name" required maxLength={80} defaultValue={department?.name ?? ""} />
            <TextField
              label="Description"
              name="description"
              optional
              maxLength={500}
              defaultValue={department?.description ?? ""}
            />
            <SelectField
              label="Sits under"
              name="parent_id"
              defaultValue={department ? (department.parentId ?? "") : (defaultParentId ?? "")}
              options={[
                { value: "", label: "Nothing: a top-level department" },
                ...parents.map((p) => ({ value: p.id, label: p.path })),
              ]}
              help="Approvals go up to this department when this one has no head, or the head is the requester."
            />
            <SelectField
              label="Head of department"
              name="head_user_id"
              defaultValue={department?.headUserId ?? ""}
              options={[
                { value: "", label: "No head" },
                ...people.map((p) => ({
                  value: p.userId,
                  label: `${p.name} · ${p.email}${p.pending ? " (not signed in yet)" : ""}`,
                })),
              ]}
              help="Approves this department's requisitions. Anyone on the staff can be a head."
            />
            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {department ? "Save" : "Add department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
