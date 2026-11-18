"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { specInputValue } from "@/lib/assets";
import { formatDate } from "@/lib/dates";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { currencySymbol } from "@/lib/money";
import { DEFAULT_MIN_STOCK } from "@/lib/spares";
import type { AssetRefs } from "../assets/data";
import { saveSpare } from "./actions";
import type { SpareRecord } from "./data";

// Add / edit a spare (02 "Add spare"): what it is, stock and storage,
// supplier and purchase, and the sub-category's specifications. One form,
// one save; the database checks everything again. Documents are attached on
// the spare's page once it exists.

export function SpareForm({ refs, spare }: { refs: AssetRefs; spare: SpareRecord | null }) {
  const startSub = spare ? refs.subCategories.find((s) => s.id === spare.subCategoryId) : undefined;
  const startRoom = spare?.roomId ? refs.rooms.find((r) => r.id === spare.roomId) : undefined;

  const [categoryId, setCategoryId] = useState(startSub?.categoryId ?? "");
  const [subId, setSubId] = useState(startSub?.id ?? "");
  const [buildingId, setBuildingId] = useState(startRoom?.buildingId ?? "");

  const subs = refs.subCategories.filter((s) => s.categoryId === categoryId);
  const sub = refs.subCategories.find((s) => s.id === subId);
  const rooms = refs.rooms.filter((r) => r.buildingId === buildingId);
  const campusName = new Map(refs.campuses.map((c) => [c.id, c.name]));

  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => saveSpare(spare?.id ?? null, prev, formData),
    initialActionState,
  );

  return (
    <form action={action} noValidate className="flex max-w-[760px] flex-col gap-5">
      {state.error && (
        <div role="alert" className="flex gap-2 rounded-sm border border-danger/40 bg-danger-tint px-3 py-2 text-small text-danger-ink">
          <CircleAlert aria-hidden className="mt-0.5 size-4 flex-none" />
          <span>{state.error}</span>
        </div>
      )}

      <Group title="What it is">
        <TextField label="Spare name" name="name" required maxLength={120} defaultValue={spare?.name ?? ""} placeholder="e.g. Compressor 1.5 Ton" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Category"
            name="category_id"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSubId("");
            }}
            options={[{ value: "", label: "Choose…" }, ...refs.categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <SelectField
            label="Sub-category"
            name="sub_category_id"
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
            disabled={!categoryId}
            options={[{ value: "", label: categoryId ? "Choose…" : "Choose a category first" }, ...subs.map((s) => ({ value: s.id, label: s.name }))]}
            help="It decides the specifications, and the asset's kind when deployed."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <TextField label="Manufacturer" name="manufacturer" optional maxLength={80} defaultValue={spare?.manufacturer ?? ""} />
          <TextField label="Model" name="model" optional maxLength={80} defaultValue={spare?.model ?? ""} />
          <TextField label="Part number" name="part_no" optional maxLength={80} defaultValue={spare?.partNo ?? ""} />
          <TextField label="Serial number" name="serial_no" optional maxLength={80} defaultValue={spare?.serialNo ?? ""} />
        </div>
      </Group>

      <Group title="Stock and storage">
        <div className="grid gap-4 sm:grid-cols-3">
          {spare ? (
            <TextField
              label="In stock"
              name="quantity_locked"
              disabled
              value={spare.quantity.toLocaleString("en-IN")}
              help="Change it with Adjust stock on the spare's page."
            />
          ) : (
            <TextField label="In stock now" name="quantity" inputMode="numeric" defaultValue="0" help="Recorded as the opening stock." />
          )}
          <TextField
            label="Minimum stock"
            name="min_stock"
            optional
            inputMode="numeric"
            defaultValue={spare?.minStock ?? ""}
            help={`At or below this it shows as low stock. Empty = ${DEFAULT_MIN_STOCK}.`}
          />
          <TextField label="Unit cost" name="unit_cost" optional inputMode="decimal" suffix={currencySymbol()} defaultValue={spare?.unitCost ?? ""} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Store building"
            name="building_id"
            optional
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            options={[
              { value: "", label: "Not recorded" },
              ...refs.buildings.map((b) => ({ value: b.id, label: `${b.name}${campusName.get(b.campusId) ? ` · ${campusName.get(b.campusId)}` : ""}` })),
            ]}
          />
          <SelectField
            key={buildingId}
            label="Store room"
            name="room_id"
            optional
            defaultValue={startRoom && startRoom.buildingId === buildingId ? startRoom.id : ""}
            disabled={!buildingId}
            options={[{ value: "", label: buildingId ? "Choose…" : "Choose a building first" }, ...rooms.map((r) => ({ value: r.id, label: `${r.name} · ${r.code}` }))]}
          />
          <TextField label="Shelf or bin" name="storage_note" optional maxLength={120} defaultValue={spare?.storageNote ?? ""} placeholder="e.g. Rack B, shelf 3" />
        </div>
        <TextField
          label="Storage and handling"
          name="handling_note"
          optional
          maxLength={500}
          defaultValue={spare?.handlingNote ?? ""}
          placeholder="e.g. Keep dry; store upright"
        />
      </Group>

      <Group title="Supplier and purchase">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Supplier"
            name="vendor_id"
            optional
            defaultValue={spare?.vendorId ?? ""}
            options={[{ value: "", label: "Not recorded" }, ...refs.vendors.map((x) => ({ value: x.id, label: `${x.name} · ${x.code}` }))]}
            help={refs.vendors.length === 0 ? <>No vendors yet. <Link href="/admin/vendors">Add them in Vendors</Link>.</> : undefined}
          />
          <TextField label="Purchase date" name="purchase_date" optional placeholder="DD-MM-YYYY" inputMode="numeric" defaultValue={formatDate(spare?.purchaseDate)} />
          <TextField
            label="Warranty until"
            name="warranty_till"
            optional
            placeholder="DD-MM-YYYY"
            inputMode="numeric"
            defaultValue={formatDate(spare?.warrantyTill)}
            help="Carried to the asset as a warranty when deployed."
          />
        </div>
        <TextField label="Note" name="notes" optional maxLength={1000} defaultValue={spare?.notes ?? ""} />
      </Group>

      <Group title="Specifications">
        {!sub ? (
          <p className="text-small text-text-3">Choose a sub-category to see its fields.</p>
        ) : sub.fields.length === 0 ? (
          <p className="text-small text-text-3">
            {sub.name} has no extra fields. <Link href="/admin/categories">Add them in Categories</Link> if needed.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sub.fields.map((f) => (
              <TextField
                key={`${sub.id}-${f.key}`}
                label={f.label}
                name={`spec:${f.key}`}
                optional={!f.required}
                maxLength={200}
                inputMode={f.type === "number" ? "decimal" : f.type === "date" ? "numeric" : undefined}
                placeholder={f.type === "date" ? "DD-MM-YYYY" : undefined}
                suffix={f.unit ?? undefined}
                defaultValue={spare && spare.subCategoryId === sub.id ? specInputValue(f, spare.specValues[f.key]) : ""}
              />
            ))}
          </div>
        )}
      </Group>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" asChild>
          <Link href={spare ? `/admin/spares/${spare.code}` : "/admin/spares"}>Cancel</Link>
        </Button>
        <span className="flex-1" />
        <Button type="submit" loading={pending}>
          {spare ? "Save changes" : "Add spare"}
        </Button>
      </div>
      {!spare && <p className="text-small text-text-3">The number (INV-…) is given when you save. Attach documents on the spare&apos;s page next.</p>}
    </form>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5 max-sm:p-4">
      <legend className="sr-only">{title}</legend>
      <h2 className="text-card">{title}</h2>
      {children}
    </fieldset>
  );
}
