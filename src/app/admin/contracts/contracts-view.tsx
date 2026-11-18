"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, PauseCircle, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { TableMessage } from "@/components/data-table/table-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DetailDrawer,
  DrawerBody,
  DrawerFacts,
  DrawerFooter,
  DrawerHeader,
  DrawerSection,
} from "@/components/ui/detail-drawer";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { FormMessage, inputClass } from "@/components/ui/field";
import { CONTRACT_KINDS, CONTRACT_STATE_LABEL, KIND_LABEL } from "@/lib/contracts";
import { formatDate } from "@/lib/dates";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { currencySymbol, formatAmount } from "@/lib/money";
import { formatCount, type TableParams } from "@/lib/table-params";
import { cn } from "cn";
import type { DocumentRow } from "../documents/data";
import { LinkedDocuments } from "../documents/linked-documents";
import { deleteContract, setNotRenewing } from "./actions";
import { ContractStateChip, contractDaysText } from "./contract-chip";
import { ContractDialog, type ContractDialogMode, type ContractRefs } from "./contract-dialog";
import { CONTRACTS_TABLE, type ContractFilters, type ContractRow } from "./contracts-table";

export function ContractsView({
  rows,
  total,
  params,
  everyone,
  attention,
  filters,
  refs,
  documents,
  timeZone,
}: {
  rows: ContractRow[];
  total: number;
  params: TableParams;
  everyone: number;
  attention: number;
  filters: ContractFilters;
  refs: ContractRefs;
  documents: DocumentRow[];
  timeZone: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ContractDialogMode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionState>(initialActionState);
  const [busy, startTransition] = useTransition();

  const index = rows.findIndex((r) => r.id === openId);
  const open = index >= 0 ? rows[index] : null;
  const deleting = rows.find((r) => r.id === deleteId) ?? null;

  function setFilter(key: keyof ContractFilters, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  const run = (task: () => Promise<ActionState>) =>
    startTransition(async () => {
      setNotice(await task());
    });

  const columns: ColumnDef<ContractRow, unknown>[] = [
    { id: "code", header: "Number", meta: { priority: 0, sticky: true }, cell: ({ row }) => <span className="id">{row.original.code}</span> },
    {
      id: "kind",
      header: "Kind",
      meta: { priority: 0 },
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{KIND_LABEL[row.original.kind]}</span>
          {row.original.contractNo && <span className="truncate text-small text-text-3">{row.original.contractNo}</span>}
        </span>
      ),
    },
    {
      id: "vendor",
      header: "Vendor",
      meta: { priority: 1 },
      cell: ({ row }) => <span className="block max-w-[200px] truncate text-text-2">{row.original.vendorName ?? "The maker"}</span>,
    },
    {
      id: "assets",
      header: "Assets",
      meta: { priority: 2, align: "end" },
      cell: ({ row }) => (
        <span className="tabular-nums" title={row.original.assets.map((a) => a.code).join(", ")}>
          {formatCount(row.original.assetIds.length)}
        </span>
      ),
    },
    {
      id: "ends",
      header: "Period",
      meta: { priority: 1 },
      cell: ({ row }) => (
        <span className="flex flex-col tabular-nums">
          <span>
            {formatDate(row.original.startsOn)} – {formatDate(row.original.endsOn)}
          </span>
          {contractDaysText(row.original.state, row.original.daysLeft) && (
            <span className="text-small text-text-3">{contractDaysText(row.original.state, row.original.daysLeft)}</span>
          )}
        </span>
      ),
    },
    { id: "state", header: "Status", meta: { priority: 0 }, cell: ({ row }) => <ContractStateChip state={row.original.state} /> },
  ];

  const stateTabs: { key: ContractFilters["state"]; label: string; count?: number }[] = [
    { key: null, label: "All" },
    { key: "attention", label: "Needs attention", count: attention },
    { key: "active", label: CONTRACT_STATE_LABEL.active },
    { key: "upcoming", label: CONTRACT_STATE_LABEL.upcoming },
    { key: "renewed", label: CONTRACT_STATE_LABEL.renewed },
    { key: "not_renewing", label: CONTRACT_STATE_LABEL.not_renewing },
  ];

  return (
    <>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      <nav aria-label="Contract status" className="flex gap-1 overflow-x-auto border-b border-border">
        {stateTabs.map((t) => {
          const on = filters.state === t.key;
          return (
            <button
              key={t.key ?? "all"}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => setFilter("state", t.key ?? "")}
              className={cn(
                "-mb-px flex flex-none items-center gap-1.5 border-b-2 px-3 py-2 text-[13.5px] font-medium",
                on ? "border-primary text-text" : "border-transparent text-text-2 hover:border-border-strong hover:text-text",
              )}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="rounded-xs bg-warning-tint px-1.5 text-xs leading-[18px] text-warning-ink tabular-nums">{t.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      <DataTable
        id="contracts"
        noun={{ one: "contract", many: "contracts" }}
        columns={columns}
        rows={rows}
        total={total}
        getRowId={(r) => r.id}
        params={params}
        defaults={CONTRACTS_TABLE}
        searchPlaceholder="Search number, vendor, contract no. or asset"
        openRowId={openId}
        onOpenRow={(r) => setOpenId((cur) => (cur === r.id ? null : r.id))}
        empty={
          everyone === 0 ? (
            <TableMessage
              icon={ShieldCheck}
              actions={
                refs.assets.length > 0 ? (
                  <Button onClick={() => setDialog({ mode: "new" })}>
                    <Plus aria-hidden /> Add warranty or AMC
                  </Button>
                ) : undefined
              }
            >
              {refs.assets.length > 0
                ? "No contracts yet. Add a warranty or an AMC and choose the assets it covers."
                : "Add assets first; contracts cover assets."}
            </TableMessage>
          ) : undefined
        }
        toolbar={
          <>
            <label className="sr-only" htmlFor="contracts-kind">
              Kind
            </label>
            <select
              id="contracts-kind"
              value={filters.kind ?? ""}
              onChange={(e) => setFilter("kind", e.target.value)}
              className={cn(inputClass, "h-8 w-auto max-w-48 cursor-pointer pr-8 text-[13px]", filters.kind && "border-primary")}
            >
              <option value="">All kinds</option>
              {CONTRACT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            {refs.assets.length > 0 && (
              <Button onClick={() => setDialog({ mode: "new" })}>
                <Plus aria-hidden /> Add warranty or AMC
              </Button>
            )}
          </>
        }
        rowMenu={(r) => (
          <>
            <DropdownMenuItem onSelect={() => setOpenId(r.id)}>
              <Eye aria-hidden /> Open details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog({ mode: "edit", contract: r })}>
              <Pencil aria-hidden /> Edit
            </DropdownMenuItem>
            {!r.renewedById && (
              <DropdownMenuItem onSelect={() => setDialog({ mode: "renew", contract: r })}>
                <RefreshCw aria-hidden /> Renew…
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteId(r.id)}>
              <Trash2 aria-hidden /> Delete…
            </DropdownMenuItem>
          </>
        )}
        renderCard={(r) => (
          <span className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
            <span className="id text-text-3">{r.code}</span>
            <ContractStateChip state={r.state} className="justify-self-end" />
            <span className="col-span-2 text-sm font-medium">
              {KIND_LABEL[r.kind]} · {r.vendorName ?? "The maker"}
            </span>
            <span className="col-span-2 text-small text-text-2 tabular-nums">
              {formatDate(r.startsOn)} – {formatDate(r.endsOn)} · {r.assetIds.length} {r.assetIds.length === 1 ? "asset" : "assets"}
            </span>
          </span>
        )}
      />

      <DetailDrawer open={open !== null} onOpenChange={(o) => !o && setOpenId(null)} width={480}>
        {open && (
          <>
            <DrawerHeader
              id={open.code}
              title={`${KIND_LABEL[open.kind]} · ${open.vendorName ?? "the maker"}`}
              chips={<ContractStateChip state={open.state} />}
              actions={
                <>
                  {!open.renewedById && (
                    <Button onClick={() => setDialog({ mode: "renew", contract: open })}>
                      <RefreshCw aria-hidden /> Renew
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => setDialog({ mode: "edit", contract: open })}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                  {!open.renewedById && (
                    <Button variant="ghost" disabled={busy} onClick={() => run(() => setNotRenewing(open.id, !open.notRenewing))}>
                      <PauseCircle aria-hidden /> {open.notRenewing ? "Will renew after all" : "Not renewing"}
                    </Button>
                  )}
                </>
              }
            />
            <DrawerBody>
              <DrawerSection title="Contract">
                <DrawerFacts
                  items={[
                    { label: "Contract no.", value: open.contractNo ?? "—" },
                    { label: "Period", value: `${formatDate(open.startsOn, timeZone)} – ${formatDate(open.endsOn, timeZone)}` },
                    { label: "Status", value: [CONTRACT_STATE_LABEL[open.state], contractDaysText(open.state, open.daysLeft)].filter(Boolean).join(" · ") },
                    { label: "Cost", value: open.cost !== null ? `${currencySymbol()} ${formatAmount(open.cost)}` : "—" },
                    { label: "Visits a year", value: open.visitsPerYear ?? "—" },
                    { label: "Covers", value: open.coverage ?? "—" },
                    ...(open.renewedFromCode ? [{ label: "Renews", value: open.renewedFromCode }] : []),
                    ...(open.renewedByCode ? [{ label: "Renewed by", value: open.renewedByCode }] : []),
                  ]}
                />
              </DrawerSection>
              <DrawerSection title={`Assets covered (${open.assets.length})`}>
                {open.assets.length === 0 ? (
                  <p className="text-small text-text-3">No assets (they were deleted).</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {open.assets.map((a) => (
                      <li key={a.id} className="flex gap-3 text-cell">
                        <Link href={`/admin/assets/${a.code}`} className="id w-20 flex-none">
                          {a.code}
                        </Link>
                        <span className="truncate">{a.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </DrawerSection>
              <DrawerSection title="Documents">
                <LinkedDocuments
                  key={open.id}
                  target={{ kind: "contract", id: open.id, label: `${open.code} · ${KIND_LABEL[open.kind]}` }}
                  documents={documents.filter((d) => d.contractIds.includes(open.id))}
                  library={documents}
                  uploadType={open.kind === "amc" || open.kind === "camc" ? "amc_contract" : "warranty"}
                />
              </DrawerSection>
              <Button variant="ghost" className="w-fit" onClick={() => setDeleteId(open.id)}>
                <Trash2 aria-hidden /> Delete contract
              </Button>
            </DrawerBody>
            <DrawerFooter
              position={`${index + 1} of ${rows.length} on this page`}
              onPrevious={index > 0 ? () => setOpenId(rows[index - 1].id) : undefined}
              onNext={index < rows.length - 1 ? () => setOpenId(rows[index + 1].id) : undefined}
            />
          </>
        )}
      </DetailDrawer>

      {dialog && (
        <ContractDialog
          key={dialog.mode === "new" ? "new" : `${dialog.mode}-${dialog.contract.id}`}
          dialog={dialog}
          refs={refs}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            setNotice({ error: null, success: message });
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={`Delete ${deleting?.code ?? "this contract"}?`}
        description="This can't be undone. For a contract that simply ended, keep it as history instead; it stops showing once renewed or marked not renewing."
        confirmLabel="Delete contract"
        typeToConfirm={deleting?.code}
        pending={busy}
        onConfirm={() => {
          const id = deleteId;
          if (!id) return;
          startTransition(async () => {
            const result = await deleteContract(id);
            setNotice(result);
            setDeleteId(null);
            if (!result.error && openId === id) setOpenId(null);
          });
        }}
      />
    </>
  );
}

