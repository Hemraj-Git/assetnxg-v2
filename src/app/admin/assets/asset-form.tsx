"use client";

import Link from "next/link";
import { useActionState, useRef, useState, type ReactNode } from "react";
import { Check, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { specInputValue } from "@/lib/assets";
import { PRIORITY_LABEL, SLA_PRIORITIES } from "@/lib/categories";
import { formatDate } from "@/lib/dates";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { currencySymbol } from "@/lib/money";
import { cn } from "cn";
import { saveAsset } from "./actions";
import type { AssetRecord, AssetRefs } from "./data";

// Canvas 1c · Add / edit asset: a vertical stepper (What it is, Where it is,
// Specifications, Review). Every field stays in one form, so one save sends
// it all; the database checks everything again. Warranty and AMC are
// contracts (next slice); documents, photo and schedules come with their
// modules.

const STEPS = [
  { title: "What it is", hint: "Name, make, purchase" },
  { title: "Where it is", hint: "Campus › building › room" },
  { title: "Specifications", hint: "Fields from the sub-category" },
  { title: "Review", hint: "Check and save" },
] as const;

type Summary = { label: string; value: string }[];

export function AssetForm({ refs, asset }: { refs: AssetRefs; asset: AssetRecord | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary>([]);

  const startSub = asset ? refs.subCategories.find((s) => s.id === asset.subCategoryId) : undefined;
  const startRoom = asset ? refs.rooms.find((r) => r.id === asset.roomId) : undefined;
  const startBuilding = startRoom ? refs.buildings.find((b) => b.id === startRoom.buildingId) : undefined;

  const [categoryId, setCategoryId] = useState(startSub?.categoryId ?? "");
  const [subId, setSubId] = useState(startSub?.id ?? "");
  const [campusId, setCampusId] = useState(startBuilding?.campusId ?? (refs.campuses.length === 1 ? refs.campuses[0].id : ""));
  const [buildingId, setBuildingId] = useState(startBuilding?.id ?? "");
  const [roomId, setRoomId] = useState(asset?.roomId ?? "");

  const subs = refs.subCategories.filter((s) => s.categoryId === categoryId);
  const sub = refs.subCategories.find((s) => s.id === subId);
  const buildings = refs.buildings.filter((b) => b.campusId === campusId);
  const rooms = refs.rooms.filter((r) => r.buildingId === buildingId);
  const installationLocked = Boolean(asset?.installationDate);

  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => saveAsset(asset?.id ?? null, prev, formData),
    initialActionState,
  );

  /** Problems a step must fix before moving on (the server checks again). */
  function check(upTo: number): string[] {
    const fd = new FormData(formRef.current ?? undefined);
    const out: string[] = [];
    if (upTo >= 0) {
      if (!String(fd.get("name") ?? "").trim()) out.push("Enter the asset's name.");
      if (!subId) out.push("Choose a category and sub-category. It decides the specifications.");
    }
    if (upTo >= 1 && !roomId) out.push("Choose the room or area where the asset is.");
    if (upTo >= 2 && sub) {
      for (const f of sub.fields) {
        if (f.required && !String(fd.get(`spec:${f.key}`) ?? "").trim()) out.push(`Fill in “${f.label}”.`);
      }
    }
    return out;
  }

  function go(next: number) {
    if (next > step) {
      const problems = check(Math.min(next - 1, 2));
      setErrors(problems);
      if (problems.length) return;
    } else {
      setErrors([]);
    }
    if (next === 3) setSummary(buildSummary());
    setStep(next);
  }

  function buildSummary(): Summary {
    const fd = new FormData(formRef.current ?? undefined);
    const v = (k: string) => String(fd.get(k) ?? "").trim();
    const category = refs.categories.find((c) => c.id === categoryId);
    const room = refs.rooms.find((r) => r.id === roomId);
    const building = refs.buildings.find((b) => b.id === buildingId);
    const campus = refs.campuses.find((c) => c.id === campusId);
    const vendor = refs.vendors.find((x) => x.id === v("purchased_from_id"));
    const person = refs.people.find((x) => x.id === v("assigned_to"));
    const priority = v("sla_priority");
    return [
      { label: "Name", value: [v("name"), [category?.name, sub?.name].filter(Boolean).join(" › ")].filter(Boolean).join(" · ") },
      { label: "Make", value: [v("manufacturer"), v("model"), v("serial_no")].filter(Boolean).join(" · ") || "—" },
      {
        label: "Purchase",
        value:
          [v("price") && `${currencySymbol()} ${v("price")}`, v("purchase_date") && `on ${v("purchase_date")}`, vendor && `from ${vendor.name}`]
            .filter(Boolean)
            .join(" ") || "—",
      },
      { label: "Installed", value: (installationLocked ? formatDate(asset?.installationDate) : v("installation_date")) || "—" },
      {
        label: "SLA priority",
        value: priority
          ? PRIORITY_LABEL[priority as keyof typeof PRIORITY_LABEL]
          : sub?.slaPriority
            ? `${PRIORITY_LABEL[sub.slaPriority]} (from the sub-category)`
            : "Requester chooses",
      },
      { label: "Assigned to", value: person?.name ?? "—" },
      { label: "Where", value: [campus?.name, building?.name, room?.name].filter(Boolean).join(" › ") || "—" },
      {
        label: "Specifications",
        value: sub?.fields.map((f) => v(`spec:${f.key}`) && `${f.label}: ${v(`spec:${f.key}`)}${f.unit ? ` ${f.unit}` : ""}`).filter(Boolean).join(" · ") || "—",
      },
    ];
  }

  const serverError = state.error;

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-6 lg:grid-cols-[220px_minmax(0,720px)]">
      <ol aria-label="Steps" className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.title} className="flex-none">
              <button
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={() => go(i)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-sm px-2.5 py-2 text-left",
                  current ? "bg-primary-weak" : "hover:bg-sunken",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-px flex size-6 flex-none items-center justify-center rounded-full border text-xs font-semibold",
                    done ? "border-primary bg-primary text-on-primary" : current ? "border-primary text-primary-ink" : "border-border-strong text-text-3",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="flex flex-col">
                  <span className="text-[13.5px] font-medium">{s.title}</span>
                  <span className="text-xs text-text-3 max-lg:hidden">{s.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex min-w-0 flex-col gap-5">
        {(errors.length > 0 || serverError) && (
          <div role="alert" className="flex gap-2 rounded-sm border border-danger/40 bg-danger-tint px-3 py-2 text-small text-danger-ink">
            <CircleAlert aria-hidden className="mt-0.5 size-4 flex-none" />
            <div className="flex flex-col gap-0.5">
              {errors.length > 1 && <span className="font-semibold">{errors.length} things need fixing before you continue</span>}
              {(errors.length ? errors : [serverError]).map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 · What it is */}
        <section hidden={step !== 0} className="flex flex-col gap-5">
          <Group title="What it is">
            <TextField label="Asset name" name="name" required maxLength={120} defaultValue={asset?.name ?? ""} placeholder="e.g. Split AC 1.5 Ton" />
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
                help="It decides the specifications and the PM templates."
              />
            </div>
            <SelectField
              label="SLA priority"
              name="sla_priority"
              defaultValue={asset?.slaPriority ?? ""}
              options={[
                { value: "", label: sub?.slaPriority ? `Same as the sub-category (${PRIORITY_LABEL[sub.slaPriority]})` : "Same as the sub-category (none: requester chooses)" },
                ...SLA_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] })),
              ]}
              help="Requests about this asset use this priority."
              className="sm:max-w-[360px]"
            />
          </Group>

          <Group title="Make and model">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Manufacturer" name="manufacturer" optional maxLength={80} defaultValue={asset?.manufacturer ?? ""} />
              <TextField label="Model" name="model" optional maxLength={80} defaultValue={asset?.model ?? ""} />
              <TextField label="Serial number" name="serial_no" optional maxLength={80} defaultValue={asset?.serialNo ?? ""} />
            </div>
          </Group>

          <Group title="Purchase">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Price" name="price" optional inputMode="decimal" suffix={currencySymbol()} defaultValue={asset?.price ?? ""} />
              <TextField label="Purchase date" name="purchase_date" optional placeholder="DD-MM-YYYY" inputMode="numeric" defaultValue={formatDate(asset?.purchaseDate)} />
              {installationLocked ? (
                <TextField
                  label="Installation date"
                  name="installation_date_locked"
                  disabled
                  value={formatDate(asset?.installationDate)}
                  help="Locked once the asset exists."
                />
              ) : (
                <TextField
                  label="Installation date"
                  name="installation_date"
                  optional
                  placeholder="DD-MM-YYYY"
                  inputMode="numeric"
                  help="Locked once saved. PM dates can start from it."
                />
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Bought from"
                name="purchased_from_id"
                defaultValue={asset?.purchasedFromId ?? ""}
                options={[{ value: "", label: "Not recorded" }, ...refs.vendors.map((x) => ({ value: x.id, label: `${x.name} · ${x.code}` }))]}
                help={refs.vendors.length === 0 ? <>No vendors yet. <Link href="/admin/vendors">Add them in Vendors</Link>.</> : undefined}
              />
              <TextField
                label="Last serviced"
                name="last_serviced_on"
                optional
                placeholder="DD-MM-YYYY"
                inputMode="numeric"
                defaultValue={formatDate(asset?.lastServicedOn)}
                help="For older assets: the first job counts from here, so it doesn't start overdue."
              />
            </div>
          </Group>

          <Group title="Who looks after it">
            <SelectField
              label="Assigned to"
              name="assigned_to"
              optional
              defaultValue={asset?.assignedTo ?? ""}
              options={[{ value: "", label: "No one" }, ...refs.people.map((p) => ({ value: p.id, label: `${p.name} · ${p.email}` }))]}
              className="sm:max-w-[420px]"
            />
            <TextField label="Note" name="notes" optional maxLength={1000} defaultValue={asset?.notes ?? ""} placeholder="Anything the next person should know" />
          </Group>
        </section>

        {/* Step 2 · Where it is */}
        <section hidden={step !== 1} className="flex flex-col gap-5">
          <Group title="Where it is">
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label="Campus"
                name="campus_id"
                value={campusId}
                onChange={(e) => {
                  setCampusId(e.target.value);
                  setBuildingId("");
                  setRoomId("");
                }}
                options={[{ value: "", label: "Choose…" }, ...refs.campuses.map((c) => ({ value: c.id, label: c.name }))]}
              />
              <SelectField
                label="Building or block"
                name="building_id"
                value={buildingId}
                disabled={!campusId}
                onChange={(e) => {
                  setBuildingId(e.target.value);
                  setRoomId("");
                }}
                options={[{ value: "", label: campusId ? "Choose…" : "Choose a campus first" }, ...buildings.map((b) => ({ value: b.id, label: b.name }))]}
              />
              <SelectField
                label="Room or area"
                name="room_id"
                value={roomId}
                disabled={!buildingId}
                onChange={(e) => setRoomId(e.target.value)}
                options={[{ value: "", label: buildingId ? "Choose…" : "Choose a building first" }, ...rooms.map((r) => ({ value: r.id, label: `${r.name} · ${r.code}` }))]}
              />
            </div>
            {buildingId && rooms.length === 0 && (
              <p className="text-small text-text-3">
                This building has no rooms yet. <Link href="/admin/locations/rooms">Add rooms in Locations</Link>.
              </p>
            )}
          </Group>
        </section>

        {/* Step 3 · Specifications */}
        <section hidden={step !== 2} className="flex flex-col gap-5">
          <Group title="Specifications">
            {!sub ? (
              <p className="text-small text-text-3">Choose a sub-category in step 1 to see its fields.</p>
            ) : sub.fields.length === 0 ? (
              <p className="text-small text-text-3">
                {sub.name} has no extra fields. <Link href="/admin/categories">Add them in Categories</Link> if assets of this kind need any.
              </p>
            ) : (
              <>
                <p className="-mt-1 text-small text-text-3">
                  These fields come from {sub.name}. Change them in <Link href="/admin/categories">Categories</Link>.
                </p>
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
                      defaultValue={asset && asset.subCategoryId === sub.id ? specInputValue(f, asset.specValues[f.key]) : ""}
                    />
                  ))}
                </div>
              </>
            )}
          </Group>
        </section>

        {/* Step 4 · Review */}
        <section hidden={step !== 3} className="flex flex-col gap-5">
          <Group title="Review">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-cell max-sm:grid-cols-1">
              {summary.map((s) => (
                <div key={s.label} className="contents">
                  <dt className="text-text-3">{s.label}</dt>
                  <dd className="min-w-0 break-words max-sm:mb-1">{s.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-small text-text-3">
              {asset
                ? "Saving keeps the asset's number and QR code."
                : "Saving gives the asset its AST- number and QR code. The installation date is locked once saved. Add its warranty and AMC on the asset's page next; documents and PM schedules follow as those parts are built."}
            </p>
          </Group>
        </section>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" asChild>
            <Link href={asset ? `/admin/assets/${asset.code}` : "/admin/assets"}>Cancel</Link>
          </Button>
          <span className="flex-1" />
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={() => go(step - 1)}>
              Back
            </Button>
          )}
          {step < 3 && (
            <Button type="button" variant={asset ? "secondary" : "default"} onClick={() => go(step + 1)}>
              Continue
            </Button>
          )}
          {(step === 3 || asset) && (
            <Button
              type="submit"
              loading={pending}
              onClick={(e) => {
                const problems = check(2);
                setErrors(problems);
                if (problems.length) e.preventDefault();
              }}
            >
              {asset ? "Save changes" : "Create asset"}
            </Button>
          )}
        </div>
      </div>
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
