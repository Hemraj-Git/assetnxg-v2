"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import { CONTRACT_KINDS, KIND_LABEL, needsVendor, type ContractKind } from "@/lib/contracts";
import { addDays, daysBetween, formatDate } from "@/lib/dates";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { currencySymbol } from "@/lib/money";
import { saveContract } from "./actions";
import { AssetPicker } from "./asset-picker";
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

  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveContract(dialog.mode === "edit" ? dialog.contract.id : null, renewing ? base!.id : null, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initialActionState);

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

            <AssetPicker refs={refs} selected={selected} onChange={setSelected} legend="Assets covered" />

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
