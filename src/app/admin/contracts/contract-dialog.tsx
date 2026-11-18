"use client";

import { useActionState, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField, inputClass } from "@/components/ui/field";
import { CONTRACT_KINDS, KIND_LABEL, needsVendor, type ContractKind } from "@/lib/contracts";
import { addDays, daysBetween, formatDate } from "@/lib/dates";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { currencySymbol } from "@/lib/money";
import { formatCount } from "@/lib/table-params";
import { cn } from "cn";
import { saveContract } from "./actions";
import type { ContractRow } from "./contracts-table";
import type { AssetOption, VendorOption } from "./data";

export type ContractRefs = {
  assets: AssetOption[];
  vendors: VendorOption[];
  categories: { id: string; name: string }[];
  buildings: { id: string; name: string }[];
};

export type ContractDialogMode =
  | { mode: "new"; assetIds?: string[]; kind?: ContractKind }
  | { mode: "edit"; contract: ContractRow }
  | { mode: "renew"; contract: ContractRow };

const SHOW_MAX = 300;

/** Add, edit or renew a warranty / AMC contract and choose the assets it
 *  covers (one or many). */
export function ContractDialog({
  dialog,
  refs,
  onClose,
  onDone,
}: {
  dialog: ContractDialogMode;
  refs: ContractRefs;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const base = dialog.mode === "new" ? null : dialog.contract;
  const renewing = dialog.mode === "renew";

  // A renewal starts the day after the old one ends and runs as long.
  const startDefault = base ? (renewing ? addDays(base.endsOn, 1) : base.startsOn) : "";
  const endDefault = base
    ? renewing
      ? addDays(addDays(base.endsOn, 1), daysBetween(base.startsOn, base.endsOn))
      : base.endsOn
    : "";

  const [kind, setKind] = useState<ContractKind>(base?.kind ?? (dialog.mode === "new" ? (dialog.kind ?? "amc") : "amc"));
  const [selected, setSelected] = useState<Set<string>>(
    new Set(base ? base.assetIds : dialog.mode === "new" ? (dialog.assetIds ?? []) : []),
  );
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [buildingId, setBuildingId] = useState("");

  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveContract(dialog.mode === "edit" ? dialog.contract.id : null, renewing ? base!.id : null, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initialActionState);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return refs.assets.filter(
      (a) =>
        (!a.retired || selected.has(a.id)) &&
        (!categoryId || a.categoryId === categoryId) &&
        (!buildingId || a.buildingId === buildingId) &&
        (!needle || `${a.code} ${a.name} ${a.category} ${a.location}`.toLowerCase().includes(needle)),
    );
  }, [refs.assets, q, categoryId, buildingId, selected]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const title =
    dialog.mode === "edit" ? `Edit ${dialog.contract.code}` : renewing ? `Renew ${base!.code}` : "Add warranty or AMC";

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="lg">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">{title}</DialogTitle>
            <DialogDescription>
              {renewing
                ? `A new contract for the next period, carrying the vendor and assets forward. ${base!.code} stays on record as renewed.`
                : "One contract can cover one asset or many. The number (CON-…) is given when you save."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Kind"
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as ContractKind)}
                options={CONTRACT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                disabled={renewing}
              />
              {renewing && <input type="hidden" name="kind" value={kind} />}
              <SelectField
                label={needsVendor(kind) ? "Vendor" : "Vendor (if not the maker)"}
                name="vendor_id"
                defaultValue={base?.vendorId ?? ""}
                optional={!needsVendor(kind)}
                options={[
                  { value: "", label: needsVendor(kind) ? "Choose…" : "The maker / not recorded" },
                  ...refs.vendors.map((v) => ({ value: v.id, label: `${v.name} · ${v.code}` })),
                ]}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Starts" name="starts_on" placeholder="DD-MM-YYYY" inputMode="numeric" defaultValue={formatDate(startDefault)} />
              <TextField label="Ends" name="ends_on" placeholder="DD-MM-YYYY" inputMode="numeric" defaultValue={formatDate(endDefault)} />
              <TextField
                label="Contract no."
                name="contract_no"
                optional
                maxLength={60}
                defaultValue={renewing ? "" : (base?.contractNo ?? "")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Cost" name="cost" optional inputMode="decimal" suffix={currencySymbol()} defaultValue={base?.cost ?? ""} />
              <TextField
                label="Visits a year"
                name="visits_per_year"
                optional
                inputMode="numeric"
                defaultValue={base?.visitsPerYear ?? ""}
                help={needsVendor(kind) ? "Service visits the AMC includes." : undefined}
              />
              <TextField
                label="What it covers"
                name="coverage"
                optional
                maxLength={500}
                defaultValue={base?.coverage ?? ""}
                placeholder={needsVendor(kind) ? "e.g. Parts and labour" : "e.g. Compressor 5 years"}
              />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] leading-[18px] font-medium">
                Assets covered <span className="font-normal text-text-3">· {formatCount(selected.size)} chosen</span>
              </legend>
              {[...selected].map((id) => (
                <input key={id} type="hidden" name="asset_ids" value={id} />
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <span className="relative min-w-48 flex-1">
                  <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-3" />
                  <input
                    aria-label="Search assets"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search ID, name or place"
                    className={cn(inputClass, "h-8 pl-8 text-[13px]")}
                  />
                </span>
                <select
                  aria-label="Category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={cn(inputClass, "h-8 w-auto max-w-40 cursor-pointer pr-8 text-[13px]")}
                >
                  <option value="">All categories</option>
                  {refs.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Building"
                  value={buildingId}
                  onChange={(e) => setBuildingId(e.target.value)}
                  className={cn(inputClass, "h-8 w-auto max-w-40 cursor-pointer pr-8 text-[13px]")}
                >
                  <option value="">All buildings</option>
                  {refs.buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-small">
                <span className="text-text-3">
                  {formatCount(shown.length)} shown{shown.length > SHOW_MAX ? ` (first ${SHOW_MAX}; search to narrow)` : ""}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={shown.length === 0}
                  onClick={() => setSelected((s) => new Set([...s, ...shown.map((a) => a.id)]))}
                >
                  Select all shown
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
              <ul className="max-h-64 overflow-y-auto rounded-sm border border-border">
                {shown.length === 0 ? (
                  <li className="px-3 py-4 text-small text-text-3">
                    {refs.assets.length === 0 ? "No assets yet. Add assets first." : "No assets match."}
                  </li>
                ) : (
                  shown.slice(0, SHOW_MAX).map((a) => (
                    <li key={a.id} className="border-b border-border last:border-b-0">
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-sunken has-checked:bg-primary-weak">
                        <input
                          type="checkbox"
                          checked={selected.has(a.id)}
                          onChange={() => toggle(a.id)}
                          className="size-4 flex-none accent-(--color-primary)"
                        />
                        <span className="id w-20 flex-none text-text-2">{a.code}</span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-cell font-medium">
                            {a.name}
                            {a.retired && <span className="font-normal text-text-3"> (retired)</span>}
                          </span>
                          <span className="truncate text-small text-text-3">
                            {[a.category, a.location].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))
                )}
              </ul>
            </fieldset>

            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {dialog.mode === "edit" ? "Save" : renewing ? "Save renewal" : "Save contract"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
