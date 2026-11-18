"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormMessage } from "@/components/ui/field";
import type { AssetStatus } from "@/lib/assets";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { deleteAsset } from "../actions";
import { StatusDialog } from "../asset-status";

/** The asset page's actions: edit, change status (retire), delete. */
export function AssetPageActions({ asset }: { asset: { id: string; code: string; name: string; status: AssetStatus } }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<ActionState>(initialActionState);
  const [busy, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" asChild>
          <Link href={`/admin/assets/${asset.code}/edit`}>
            <Pencil aria-hidden /> Edit
          </Link>
        </Button>
        <Button variant="secondary" onClick={() => setStatusOpen(true)}>
          <ArrowUpDown aria-hidden /> Change status
        </Button>
        <Button variant="ghost" onClick={() => setDeleting(true)}>
          <Trash2 aria-hidden /> Delete
        </Button>
      </div>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      {statusOpen && (
        <StatusDialog
          ids={[asset.id]}
          current={asset.status}
          onClose={() => setStatusOpen(false)}
          onDone={(result) => {
            setNotice(result);
            setStatusOpen(false);
          }}
        />
      )}

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${asset.code}?`}
        description="Only for an asset added by mistake: it can't be undone. An asset that was in use should be retired instead, so its history stays in reports."
        confirmLabel="Delete asset"
        typeToConfirm={asset.code}
        pending={busy}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteAsset(asset.id);
            setNotice(result);
            setDeleting(false);
          })
        }
      />
    </div>
  );
}
