"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { KIND_LABEL, currentCover } from "@/lib/contracts";
import { formatDate } from "@/lib/dates";
import { ContractStateChip, contractDaysText } from "../../contracts/contract-chip";
import { ContractDialog, type ContractDialogMode, type ContractRefs } from "../../contracts/contract-dialog";
import type { ContractRow } from "../../contracts/contracts-table";

/** Asset page · Warranty and AMC: the current warranty and AMC with days
 *  left, the history, and Add / Renew (one contract can cover many assets). */
export function AssetCoverPanel({
  assetId,
  contracts,
  refs,
  today,
}: {
  assetId: string;
  contracts: ContractRow[];
  refs: ContractRefs;
  today: string;
}) {
  const [dialog, setDialog] = useState<ContractDialogMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cover = currentCover(contracts, today);
  const current = [cover.warranty, cover.maintenance].filter((c): c is ContractRow => Boolean(c));
  const others = contracts
    .filter((c) => !current.includes(c))
    .sort((a, b) => b.endsOn.localeCompare(a.endsOn));

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 max-sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-card">Warranty and AMC</h2>
        <Button variant="secondary" size="sm" onClick={() => setDialog({ mode: "new", assetIds: [assetId] })}>
          <Plus aria-hidden /> Add
        </Button>
      </div>
      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      {current.length === 0 ? (
        <p className="text-small text-text-2">
          No warranty or AMC recorded. Add one here, or on <Link href="/admin/contracts">Warranty &amp; AMC</Link> to cover
          several assets at once.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {current.map((c) => (
            <li key={c.id} className="flex flex-col gap-1.5 rounded-sm border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13.5px] font-medium">
                    {KIND_LABEL[c.kind]}
                    {c.vendorName ? ` · ${c.vendorName}` : ""}
                  </span>
                  <span className="text-small text-text-3 tabular-nums">
                    {formatDate(c.startsOn)} – {formatDate(c.endsOn)}
                    {c.visitsPerYear ? ` · ${c.visitsPerYear} visits a year` : ""}
                  </span>
                </span>
                <ContractStateChip state={c.state} />
              </div>
              <span className="text-small text-text-2">
                {[contractDaysText(c.state, c.daysLeft), c.assetIds.length > 1 ? `covers ${c.assetIds.length} assets` : "", c.code]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {!c.renewedById && (c.state === "ends_soon" || c.state === "ended") && (
                <Button variant="secondary" size="sm" className="w-fit" onClick={() => setDialog({ mode: "renew", contract: c })}>
                  <RefreshCw aria-hidden /> Renew
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <details className="text-small">
          <summary className="cursor-pointer text-text-2">Earlier and later contracts ({others.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {others.map((c) => (
              <li key={c.id} className="flex justify-between gap-2 text-text-2">
                <span>
                  {c.code} · {KIND_LABEL[c.kind]} · {formatDate(c.startsOn)} – {formatDate(c.endsOn)}
                </span>
                <ContractStateChip state={c.state} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {dialog && (
        <ContractDialog
          dialog={dialog}
          refs={refs}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            setNotice(message);
          }}
        />
      )}
    </section>
  );
}
