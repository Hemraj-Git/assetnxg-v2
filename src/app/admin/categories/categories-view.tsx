"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Circle,
  CornerDownRight,
  Flame,
  MoreHorizontal,
  Pencil,
  Plus,
  Tag,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
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
import { CheckboxRow, FormMessage, SelectField, TextField, inputClass } from "@/components/ui/field";
import { StatusChip, type ChipTone } from "@/components/ui/status-chip";
import {
  FIELD_TYPE_LABEL,
  MAX_ASSET_FIELDS,
  PRIORITY_LABEL,
  SLA_PRIORITIES,
  newFieldKey,
  type AssetField,
  type AssetFieldType,
  type CategoryNode,
  type SlaPriority,
  type SubCategoryNode,
  type TaxonomyRow,
} from "@/lib/categories";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { REPEAT_LABEL } from "@/lib/templates";
import { deleteTaxonomy, saveCategory, saveSubCategory } from "./actions";
import type { TemplateOption } from "./data";

const PRIORITY_STYLE: Record<SlaPriority, { tone: ChipTone; icon: LucideIcon }> = {
  critical: { tone: "danger", icon: Flame },
  high: { tone: "warning", icon: TriangleAlert },
  medium: { tone: "info", icon: Circle },
  low: { tone: "neutral", icon: ArrowDown },
};

export function PriorityChip({ priority }: { priority: SlaPriority }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <StatusChip tone={s.tone} icon={s.icon}>
      {PRIORITY_LABEL[priority]}
    </StatusChip>
  );
}

type Editing =
  | { kind: "category"; category: CategoryNode | null }
  | { kind: "sub"; sub: SubCategoryNode | null; category: CategoryNode }
  | null;

type Deleting = { kind: "category" | "sub"; id: string; code: string; name: string; blocked: boolean } | null;

export function CategoriesView({
  rows,
  categories,
  templates,
}: {
  rows: TaxonomyRow[];
  categories: CategoryNode[];
  templates: TemplateOption[];
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const [notice, setNotice] = useState<ActionState>(initialActionState);
  const [busy, startTransition] = useTransition();

  const done = (message: string) => {
    setEditing(null);
    setNotice({ error: null, success: message });
  };

  return (
    <>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setEditing({ kind: "category", category: null })}>
          <Plus aria-hidden /> Add category
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        {rows.length === 0 ? (
          <TableMessage
            icon={Tag}
            actions={
              <Button onClick={() => setEditing({ kind: "category", category: null })}>
                <Plus aria-hidden /> Add category
              </Button>
            }
          >
            No categories yet. Start with broad groups (Electrical, HVAC, Plumbing), then add sub-categories for each kind of asset.
          </TableMessage>
        ) : (
          <table className="w-full min-w-[680px] border-separate border-spacing-0 text-cell">
            <thead>
              <tr>
                {["Category / sub-category", "Default priority", "Asset fields", ""].map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={`border-b border-border px-4 py-2.5 text-left text-[12.5px] font-medium text-text-2 ${h === "" ? "w-12" : ""}`}
                  >
                    {h || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                row.kind === "category" ? (
                  <tr key={row.category.id} className="bg-sunken/50 hover:bg-sunken">
                    <th scope="row" className="border-b border-border px-4 py-2.5 text-left font-normal">
                      <span className="flex min-w-0 flex-col">
                        <button
                          type="button"
                          onClick={() => setEditing({ kind: "category", category: row.category })}
                          className="w-fit text-left font-semibold hover:underline"
                        >
                          {row.category.name}
                        </button>
                        <span className="text-small text-text-3">
                          <span className="id">{row.category.code}</span>
                          {" · "}
                          {row.subCount} {row.subCount === 1 ? "sub-category" : "sub-categories"}
                          {row.category.description ? ` · ${row.category.description}` : ""}
                        </span>
                      </span>
                    </th>
                    <td className="border-b border-border px-4 py-2.5" />
                    <td className="border-b border-border px-4 py-2.5" />
                    <td className="border-b border-border px-2 py-1.5 text-right">
                      <RowMenu label={row.category.name}>
                        <DropdownMenuItem onSelect={() => setEditing({ kind: "category", category: row.category })}>
                          <Pencil aria-hidden /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEditing({ kind: "sub", sub: null, category: row.category })}>
                          <Plus aria-hidden /> Add a sub-category
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            setDeleting({
                              kind: "category",
                              id: row.category.id,
                              code: row.category.code,
                              name: row.category.name,
                              blocked: row.subCount > 0,
                            })
                          }
                        >
                          <Trash2 aria-hidden /> Delete…
                        </DropdownMenuItem>
                      </RowMenu>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.sub.id} className="hover:bg-sunken">
                    <th scope="row" className="border-b border-border px-4 py-2.5 text-left font-normal">
                      <span className="flex items-start gap-2 pl-4">
                        <CornerDownRight aria-hidden className="mt-0.5 size-4 flex-none text-text-3" />
                        <span className="flex min-w-0 flex-col">
                          <button
                            type="button"
                            onClick={() => setEditing({ kind: "sub", sub: row.sub, category: row.category })}
                            className="w-fit text-left font-medium hover:underline"
                          >
                            {row.sub.name}
                          </button>
                          <span className="text-small text-text-3">
                            <span className="id">{row.sub.code}</span>
                            {row.sub.templateIds.length > 0
                              ? ` · ${row.sub.templateIds.length} ${row.sub.templateIds.length === 1 ? "template" : "templates"}`
                              : ""}
                            {row.sub.description ? ` · ${row.sub.description}` : ""}
                          </span>
                        </span>
                      </span>
                    </th>
                    <td className="border-b border-border px-4 py-2.5">
                      {row.sub.slaPriority ? (
                        <PriorityChip priority={row.sub.slaPriority} />
                      ) : (
                        <span className="text-text-3">Requester chooses</span>
                      )}
                    </td>
                    <td className="border-b border-border px-4 py-2.5 text-text-2">
                      {row.sub.assetFields.length === 0 ? (
                        <span className="text-text-3">None</span>
                      ) : (
                        <span className="line-clamp-2 max-w-[320px]">{row.sub.assetFields.map((f) => f.label).join(", ")}</span>
                      )}
                    </td>
                    <td className="border-b border-border px-2 py-1.5 text-right">
                      <RowMenu label={row.sub.name}>
                        <DropdownMenuItem onSelect={() => setEditing({ kind: "sub", sub: row.sub, category: row.category })}>
                          <Pencil aria-hidden /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            setDeleting({ kind: "sub", id: row.sub.id, code: row.sub.code, name: row.sub.name, blocked: false })
                          }
                        >
                          <Trash2 aria-hidden /> Delete…
                        </DropdownMenuItem>
                      </RowMenu>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>

      {editing?.kind === "category" && (
        <CategoryDialog
          key={editing.category?.id ?? "new"}
          category={editing.category}
          onClose={() => setEditing(null)}
          onDone={done}
        />
      )}
      {editing?.kind === "sub" && (
        <SubCategoryDialog
          key={editing.sub?.id ?? `new-${editing.category.id}`}
          sub={editing.sub}
          category={editing.category}
          templates={templates}
          onClose={() => setEditing(null)}
          onDone={done}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description={
          deleting?.blocked
            ? "It still has sub-categories. Delete them first, or the delete is refused."
            : deleting?.kind === "sub"
              ? "This can't be undone. Once assets use a sub-category, it can't be deleted."
              : "This can't be undone."
        }
        confirmLabel={deleting?.kind === "category" ? "Delete category" : "Delete sub-category"}
        typeToConfirm={deleting?.code}
        pending={busy}
        onConfirm={() => {
          const target = deleting;
          if (!target) return;
          startTransition(async () => {
            setNotice(await deleteTaxonomy(target.kind, target.id));
            setDeleting(null);
          });
        }}
      />

      {categories.length > 0 && (
        <p className="max-w-3xl text-small text-text-3">
          Codes come from the name (Electrical → ELEC, Lighting → ELEC-LIGH) and never change, even after a rename.
          Preventive and inspection templates are linked to sub-categories once checklist templates are set up.
        </p>
      )}
    </>
  );
}

function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function CategoryDialog({
  category,
  onClose,
  onDone,
}: {
  category: CategoryNode | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveCategory(category?.id ?? null, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initialActionState);

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="sm">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">{category ? `Edit ${category.name}` : "Add category"}</DialogTitle>
            <DialogDescription>
              {category ? `${category.code} (the code stays the same)` : "The code is made from the name, e.g. Electrical → ELEC."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <TextField label="Name" name="name" required maxLength={60} defaultValue={category?.name ?? ""} />
            <TextField label="Description" name="description" optional maxLength={300} defaultValue={category?.description ?? ""} />
            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {category ? "Save" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Sub-category: details and asset fields ─────────────

type DraftField = AssetField & { unit: string | null };

function SubCategoryDialog({
  sub,
  category,
  templates,
  onClose,
  onDone,
}: {
  sub: SubCategoryNode | null;
  category: CategoryNode;
  templates: TemplateOption[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [fields, setFields] = useState<DraftField[]>(sub?.assetFields ?? []);
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveSubCategory(sub?.id ?? null, category.id, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initialActionState);

  const update = (i: number, change: Partial<DraftField>) =>
    setFields((list) => list.map((f, j) => (j === i ? { ...f, ...change } : f)));
  const move = (i: number, by: -1 | 1) =>
    setFields((list) => {
      const next = [...list];
      const [item] = next.splice(i, 1);
      next.splice(i + by, 0, item);
      return next;
    });

  const removedKeys = (sub?.assetFields ?? []).filter((f) => !fields.some((d) => d.key === f.key));

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="lg">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">{sub ? `Edit ${sub.name}` : `Add a sub-category to ${category.name}`}</DialogTitle>
            <DialogDescription>
              {sub ? `${sub.code} (the code stays the same)` : `The code is made from the name, e.g. ${category.code}-LIGH.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <TextField label="Name" name="name" required maxLength={60} defaultValue={sub?.name ?? ""} placeholder="e.g. Split AC" />
              <SelectField
                label="Default priority"
                name="sla_priority"
                defaultValue={sub?.slaPriority ?? ""}
                options={[
                  { value: "", label: "None: requester chooses" },
                  ...SLA_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] })),
                ]}
              />
            </div>
            <TextField label="Description" name="description" optional maxLength={300} defaultValue={sub?.description ?? ""} />
            <p className="-mt-2 text-small text-text-3">
              A request about an asset uses the asset&apos;s own priority; if it has none, this one; if neither, the person
              raising it chooses.
            </p>

            {templates.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-[13px] leading-[18px] font-medium">PM and inspection templates</legend>
                <p className="text-small text-text-3">
                  Assets of this kind are offered these checklists when schedules start. Not ticked here = &ldquo;Not
                  scheduled&rdquo; never shows for them.
                </p>
                {(["pm", "inspection"] as const).map((kind) => {
                  const list = templates.filter((t) => t.kind === kind);
                  if (list.length === 0) return null;
                  return (
                    <div key={kind} className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-text-3 uppercase">{kind === "pm" ? "PM" : "Inspection"}</span>
                      <div className="grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2">
                        {list.map((t) => (
                          <CheckboxRow
                            key={t.id}
                            name="template_ids"
                            value={t.id}
                            title={t.title}
                            description={REPEAT_LABEL[t.repeats]}
                            defaultChecked={sub?.templateIds.includes(t.id) ?? false}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                <p className="text-small text-text-3">
                  Need another? <Link href="/admin/templates">Create it in Checklist templates</Link>, then tick it here.
                </p>
              </fieldset>
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] leading-[18px] font-medium">Asset fields</legend>
              <p className="text-small text-text-3">
                Extra details every asset of this kind records, e.g. Capacity (Number, kVA) or Refrigerant (Text).
              </p>
              <input type="hidden" name="asset_fields" value={JSON.stringify(fields)} />

              {fields.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {fields.map((f, i) => (
                    <li
                      key={f.key}
                      className="grid grid-cols-[1fr_120px_96px_auto_auto] items-center gap-2 rounded-sm border border-border p-2 max-sm:grid-cols-2"
                    >
                      <input
                        aria-label={`Field ${i + 1} name`}
                        value={f.label}
                        maxLength={60}
                        placeholder="Field name"
                        onChange={(e) => update(i, { label: e.target.value })}
                        className={`${inputClass} h-8 max-sm:col-span-2`}
                      />
                      <select
                        aria-label={`Field ${i + 1} type`}
                        value={f.type}
                        onChange={(e) => {
                          const type = e.target.value as AssetFieldType;
                          update(i, type === "date" ? { type, unit: null } : { type });
                        }}
                        className={`${inputClass} h-8 cursor-pointer`}
                      >
                        {(Object.keys(FIELD_TYPE_LABEL) as AssetFieldType[]).map((t) => (
                          <option key={t} value={t}>
                            {FIELD_TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`Field ${i + 1} unit`}
                        value={f.unit ?? ""}
                        maxLength={20}
                        placeholder="Unit"
                        disabled={f.type === "date"}
                        onChange={(e) => update(i, { unit: e.target.value || null })}
                        className={`${inputClass} h-8`}
                      />
                      <label className="flex items-center gap-1.5 text-[12.5px] whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={f.required}
                          onChange={(e) => update(i, { required: e.target.checked })}
                          className="size-4 accent-(--color-primary)"
                        />
                        Required
                      </label>
                      <span className="flex items-center justify-end gap-0.5">
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${f.label || "field"} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move ${f.label || "field"} down`}
                          disabled={i === fields.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${f.label || "field"}`}
                          onClick={() => setFields((list) => list.filter((_, j) => j !== i))}
                        >
                          <X aria-hidden />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={fields.length >= MAX_ASSET_FIELDS}
                  onClick={() =>
                    setFields((list) => [...list, { key: newFieldKey(), label: "", type: "text", unit: null, required: false }])
                  }
                >
                  <Plus aria-hidden /> Add field
                </Button>
              </div>
              {removedKeys.length > 0 && (
                <p className="text-small text-warning-ink">
                  Removing {removedKeys.map((f) => `“${f.label}”`).join(", ")} hides it on assets of this kind.
                </p>
              )}
            </fieldset>

            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {sub ? "Save" : "Add sub-category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
