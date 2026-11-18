"use client";

import { useState, useTransition } from "react";
import { Archive, Ban, CircleCheck, Wrench, type LucideIcon } from "lucide-react";
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
import { StatusChip, type ChipTone } from "@/components/ui/status-chip";
import { ASSET_STATUSES, ASSET_STATUS_LABEL, type AssetStatus } from "@/lib/assets";
import type { ActionState } from "@/lib/form-actions";
import { setAssetStatus } from "./actions";

const STYLE: Record<AssetStatus, { tone: ChipTone; icon: LucideIcon }> = {
  operational: { tone: "success", icon: CircleCheck },
  under_maintenance: { tone: "warning", icon: Wrench },
  in_storage: { tone: "neutral", icon: Archive },
  retired: { tone: "neutral", icon: Ban },
};

export function AssetStatusChip({ status, className }: { status: AssetStatus; className?: string }) {
  const s = STYLE[status];
  return (
    <StatusChip tone={s.tone} icon={s.icon} className={className}>
      {ASSET_STATUS_LABEL[status]}
    </StatusChip>
  );
}

/** Change the status of one or many assets; retiring asks why. */
export function StatusDialog({
  ids,
  current,
  onClose,
  onDone,
}: {
  ids: string[];
  current?: AssetStatus;
  onClose: () => void;
  onDone: (result: ActionState) => void;
}) {
  const [status, setStatus] = useState<AssetStatus>(current && current !== "operational" ? "operational" : "under_maintenance");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const many = ids.length > 1;

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="sm">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await setAssetStatus(ids, status, reason);
              if (result.error) setError(result.error);
              else onDone(result);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-card">{many ? `Change status of ${ids.length} assets` : "Change status"}</DialogTitle>
            <DialogDescription>
              Work orders will also set this when jobs start and finish (they never change Retired or In storage assets).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <SelectField
              label="New status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AssetStatus)}
              options={ASSET_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS_LABEL[s] }))}
            />
            {status === "retired" && (
              <TextField
                label="Why is it being retired?"
                name="reason"
                value={reason}
                maxLength={200}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Beyond economical repair"
                help="Retired assets stay in reports with their history. The retirement date is today."
              />
            )}
            {error && <FormMessage tone="error">{error}</FormMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} variant={status === "retired" ? "destructive" : "default"}>
              {status === "retired" ? (many ? `Retire ${ids.length} assets` : "Retire asset") : "Change status"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
