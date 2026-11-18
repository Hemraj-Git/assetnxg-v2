"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Camera, Copy, Info, MessageSquareText, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormMessage, SelectField, TextField, inputClass } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import {
  MAX_ITEMS,
  REPEATS,
  REPEAT_LABEL,
  RESPONSES,
  RESPONSE_LABEL,
  newItemKey,
  type ChecklistItem,
  type ChecklistKind,
  type RepeatInterval,
  type ResponseType,
} from "@/lib/templates";
import { cn } from "cn";
import { deleteTemplate, saveTemplate } from "./actions";

// Canvas "Checklist templates" editor: details, the item builder (reorder
// with arrows; keyboard friendly) and a phone preview of the selected item.

type Draft = ChecklistItem & { showInstructions?: boolean };

/** The saved shape (without the editor-only flag). */
const toItem = (d: Draft): ChecklistItem => ({
  key: d.key,
  text: d.text,
  instructions: d.instructions,
  response: d.response,
  unit: d.unit,
  mandatory: d.mandatory,
  photo_required: d.photo_required,
});

const blankItem = (): Draft => ({
  key: newItemKey(),
  text: "",
  instructions: null,
  response: "checkbox",
  unit: null,
  mandatory: true,
  photo_required: false,
});

export function TemplateEditor({
  kind,
  template,
  usedBy,
}: {
  kind: ChecklistKind;
  /** null = new; `id: null` with values = a duplicate to save as new. */
  template: {
    id: string | null;
    title: string;
    description: string | null;
    repeats: RepeatInterval;
    items: ChecklistItem[];
  } | null;
  usedBy: string[];
}) {
  const [items, setItems] = useState<Draft[]>(
    template?.items.length ? template.items.map((i) => ({ ...i, key: template.id ? i.key : newItemKey() })) : [blankItem()],
  );
  const [selected, setSelected] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const id = template?.id ?? null;

  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => saveTemplate(id, kind, prev, formData),
    initialActionState,
  );

  const update = (i: number, change: Partial<Draft>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...change } : it)));
  const move = (i: number, by: -1 | 1) => {
    setItems((list) => {
      const next = [...list];
      const [it] = next.splice(i, 1);
      next.splice(i + by, 0, it);
      return next;
    });
    setSelected(i + by);
  };
  const preview = items[Math.min(selected, items.length - 1)];

  return (
    <form action={action} noValidate className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        {usedBy.length > 0 && (
          <div role="status" className="flex gap-2 rounded-sm border border-info/40 bg-info-tint px-3 py-2 text-small text-info-ink">
            <Info aria-hidden className="mt-0.5 size-4 flex-none" />
            <span>
              <span className="font-semibold">
                Used by {usedBy.length} {usedBy.length === 1 ? "sub-category" : "sub-categories"}: {usedBy.join(", ")}.
              </span>{" "}
              Changes apply to jobs created from now on; jobs already open keep their checklist.
            </span>
          </div>
        )}

        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5 max-sm:p-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <TextField label="Title" name="title" required maxLength={120} defaultValue={template?.title ?? ""} placeholder="e.g. Split AC monthly service" />
            <SelectField
              label="Repeats"
              name="repeats"
              defaultValue={template?.repeats ?? "monthly"}
              options={REPEATS.map((r) => ({ value: r, label: REPEAT_LABEL[r] }))}
            />
          </div>
          <TextField label="Description" name="description" optional maxLength={300} defaultValue={template?.description ?? ""} />
        </section>

        <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 max-sm:p-4">
          <div className="flex flex-col">
            <h2 className="text-card">Checklist items</h2>
            <span className="text-small text-text-3">
              {items.length} {items.length === 1 ? "item" : "items"} · in the order the technician sees them
            </span>
          </div>
          <input type="hidden" name="items" value={JSON.stringify(items.map(toItem))} />

          <ol className="flex flex-col gap-2">
            {items.map((it, i) => (
              <li
                key={it.key}
                onFocusCapture={() => setSelected(i)}
                className={cn("flex flex-col gap-2 rounded-sm border p-2.5", i === selected ? "border-primary bg-primary-weak/40" : "border-border")}
              >
                <div className="grid grid-cols-[auto_1fr] items-center gap-2 sm:grid-cols-[auto_1fr_150px_auto]">
                  <span className="w-6 text-center text-small text-text-3 tabular-nums">{i + 1}</span>
                  <input
                    aria-label={`Item ${i + 1} wording`}
                    value={it.text}
                    maxLength={200}
                    placeholder="What to check or do"
                    onChange={(e) => update(i, { text: e.target.value })}
                    className={cn(inputClass, "h-8")}
                  />
                  <select
                    aria-label={`Item ${i + 1} answer`}
                    value={it.response}
                    onChange={(e) => {
                      const response = e.target.value as ResponseType;
                      update(i, response === "numeric" ? { response } : { response, unit: null });
                    }}
                    className={cn(inputClass, "h-8 cursor-pointer max-sm:col-span-2")}
                  >
                    {RESPONSES.map((r) => (
                      <option key={r} value={r}>
                        {RESPONSE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <span className="flex items-center justify-end gap-0.5 max-sm:col-span-2">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move item ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move item ${i + 1} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove item ${i + 1}`}
                      disabled={items.length === 1}
                      onClick={() => {
                        setItems((list) => list.filter((_, j) => j !== i));
                        setSelected(Math.max(0, i - 1));
                      }}
                    >
                      <X aria-hidden />
                    </Button>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-8 text-[12.5px]">
                  {it.response === "numeric" && (
                    <input
                      aria-label={`Item ${i + 1} unit`}
                      value={it.unit ?? ""}
                      maxLength={20}
                      placeholder="Unit, e.g. °C"
                      onChange={(e) => update(i, { unit: e.target.value || null })}
                      className={cn(inputClass, "h-7 w-32 text-[12.5px]")}
                    />
                  )}
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={it.mandatory} onChange={(e) => update(i, { mandatory: e.target.checked })} className="size-4 accent-(--color-primary)" />
                    Required
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={it.photo_required}
                      onChange={(e) => update(i, { photo_required: e.target.checked })}
                      className="size-4 accent-(--color-primary)"
                    />
                    <Camera aria-hidden className="size-3.5" /> Photo required
                  </label>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-text-2 hover:text-text"
                    aria-expanded={Boolean(it.showInstructions || it.instructions)}
                    onClick={() => update(i, { showInstructions: !(it.showInstructions || it.instructions) })}
                  >
                    <MessageSquareText aria-hidden className="size-3.5" />
                    {it.instructions ? "Instructions" : "Add instructions"}
                  </button>
                </div>
                {(it.showInstructions || it.instructions) && (
                  <textarea
                    aria-label={`Item ${i + 1} instructions`}
                    value={it.instructions ?? ""}
                    maxLength={500}
                    rows={2}
                    placeholder="How to do it, safety notes, what good looks like"
                    onChange={(e) => update(i, { instructions: e.target.value || null })}
                    className={cn(inputClass, "ml-8 h-auto w-[calc(100%-2rem)] py-1.5 text-[13px]")}
                  />
                )}
              </li>
            ))}
          </ol>
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={items.length >= MAX_ITEMS}
              onClick={() => {
                setItems((list) => [...list, blankItem()]);
                setSelected(items.length);
              }}
            >
              <Plus aria-hidden /> Add item
            </Button>
          </div>
        </section>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" asChild>
            <Link href={`/admin/templates?kind=${kind}`}>Cancel</Link>
          </Button>
          {id && (
            <>
              <Button type="button" variant="ghost" asChild>
                <Link href={`/admin/templates/new?kind=${kind}&from=${id}`}>
                  <Copy aria-hidden /> Duplicate
                </Link>
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDeleting(true)}>
                <Trash2 aria-hidden /> Delete
              </Button>
            </>
          )}
          <span className="flex-1" />
          <Button type="submit" loading={pending}>
            {id ? "Save changes" : "Create template"}
          </Button>
        </div>
        {deleteError && <FormMessage tone="error">{deleteError}</FormMessage>}
      </div>

      <section aria-label="Phone preview" className="flex flex-col items-center gap-2 xl:sticky xl:top-4">
        <span className="text-small text-text-3">How the technician sees step {Math.min(selected, items.length - 1) + 1}</span>
        <div className="w-[300px] overflow-hidden rounded-[28px] border-[6px] border-text bg-white text-[#0F172A] shadow-2">
          <div className="flex flex-col gap-0.5 bg-[#1D4ED8] px-4 pt-5 pb-3 text-white">
            <span className="text-[11px] opacity-85">
              Step {Math.min(selected, items.length - 1) + 1} of {items.length}
            </span>
            <span className="truncate text-[15px] font-semibold">{kind === "pm" ? "Preventive job" : "Inspection"}</span>
          </div>
          <div className="flex min-h-[260px] flex-col gap-3 bg-[#F1F5F9] p-3">
            {preview && (
              <div className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-1">
                <span className="text-[15px] font-semibold">{preview.text || "Item wording"}</span>
                {preview.instructions && <span className="text-[13px] text-[#475569]">{preview.instructions}</span>}
                <span className="text-[12px] text-[#475569]">
                  {[preview.mandatory ? "Required" : "Optional", preview.photo_required ? "photo required" : ""].filter(Boolean).join(" · ")}
                </span>
                <PreviewAnswer item={preview} />
                {preview.photo_required && (
                  <span className="flex h-11 items-center justify-center rounded-lg border border-dashed border-[#7A8597] text-[13px]">
                    Add photo
                  </span>
                )}
              </div>
            )}
            <div className="mt-auto flex gap-2">
              <span className="flex h-11 flex-1 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[13px]">Back</span>
              <span className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[#1D4ED8] text-[13px] text-white">Next</span>
            </div>
          </div>
        </div>
        <span className="text-xs text-text-3">Preview updates as you edit.</span>
      </section>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${template?.title ?? "this template"}?`}
        description={
          usedBy.length
            ? `It's used by ${usedBy.join(", ")}. Remove it from them in Categories first, or the delete is refused.`
            : "This can't be undone."
        }
        confirmLabel="Delete template"
        pending={busy}
        onConfirm={() => {
          if (!id) return;
          startTransition(async () => {
            const result = await deleteTemplate(id);
            setDeleting(false);
            if (result.error) setDeleteError(result.error);
          });
        }}
      />
    </form>
  );
}

function PreviewAnswer({ item }: { item: ChecklistItem }) {
  const pair = (a: string, b: string) => (
    <div className="flex gap-2">
      <span className="flex h-11 flex-1 items-center justify-center rounded-lg border border-[#CBD5E1] text-[13px]">{a}</span>
      <span className="flex h-11 flex-1 items-center justify-center rounded-lg border border-[#CBD5E1] text-[13px]">{b}</span>
    </div>
  );
  switch (item.response) {
    case "pass_fail":
      return pair("✓ Pass", "Fail");
    case "yes_no":
      return pair("Yes", "No");
    case "checkbox":
      return pair("✓ Done", "Not done");
    case "numeric":
      return (
        <span className="flex h-11 items-center justify-between rounded-lg border border-[#7A8597] px-3 text-[13px] text-[#5F6B7E]">
          <span>Number</span>
          <span>{item.unit}</span>
        </span>
      );
    default:
      return <span className="flex h-16 items-start rounded-lg border border-[#7A8597] px-3 py-2 text-[13px] text-[#5F6B7E]">Type here</span>;
  }
}
