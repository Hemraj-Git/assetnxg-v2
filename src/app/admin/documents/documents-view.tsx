"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, ExternalLink, Eye, FileText, Pencil, Trash2, Upload } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { TableMessage } from "@/components/data-table/table-message";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { StatusChip } from "@/components/ui/status-chip";
import { formatDate, formatTime } from "@/lib/dates";
import { DOC_TYPES, DOC_TYPE_LABEL, documentFileHref, fileKind, formatFileSize } from "@/lib/documents";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { type TableParams } from "@/lib/table-params";
import { cn } from "cn";
import { deleteDocument } from "./actions";
import type { DocumentRow } from "./data";
import { DocumentDialog, type DocumentDialogMode, type DocumentLinkRefs } from "./document-dialog";
import { DOCUMENTS_TABLE, linksText, type DocumentFilters } from "./documents-table";


export function DocumentsView({
  rows,
  total,
  params,
  everyone,
  unlinked,
  filters,
  refs,
  timeZone,
}: {
  rows: DocumentRow[];
  total: number;
  params: TableParams;
  everyone: number;
  unlinked: number;
  filters: DocumentFilters;
  refs: DocumentLinkRefs;
  timeZone: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DocumentDialogMode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionState>(initialActionState);
  const [busy, startTransition] = useTransition();

  const index = rows.findIndex((r) => r.id === openId);
  const open = index >= 0 ? rows[index] : null;
  const deleting = rows.find((r) => r.id === deleteId) ?? null;
  const deletingLinks = deleting ? deleting.assetIds.length + deleting.contractIds.length : 0;

  function setFilter(key: keyof DocumentFilters, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  const columns: ColumnDef<DocumentRow, unknown>[] = [
    { id: "code", header: "Number", meta: { priority: 0, sticky: true }, cell: ({ row }) => <span className="id">{row.original.code}</span> },
    {
      id: "title",
      header: "Title",
      meta: { priority: 0 },
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.original.title}</span>
          <span className="truncate text-small text-text-3">{row.original.fileName}</span>
        </span>
      ),
    },
    { id: "type", header: "Type", meta: { priority: 1 }, cell: ({ row }) => DOC_TYPE_LABEL[row.original.docType] },
    {
      id: "links",
      header: "Linked to",
      meta: { priority: 1 },
      cell: ({ row }) => {
        const d = row.original;
        const text = linksText(d);
        return d.assetIds.length + d.contractIds.length === 0 ? (
          <span className="text-text-3">{text}</span>
        ) : (
          <span title={[...d.assets, ...d.contracts].map((x) => x.code).join(", ")}>{text}</span>
        );
      },
    },
    {
      id: "size",
      header: "Size",
      meta: { priority: 2, align: "end" },
      cell: ({ row }) => (
        <span className="text-text-2 tabular-nums">
          {fileKind(row.original.fileType)} · {formatFileSize(row.original.fileSize)}
        </span>
      ),
    },
    {
      id: "uploaded",
      header: "Uploaded",
      meta: { priority: 1 },
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="tabular-nums">{formatDate(row.original.createdAt, timeZone)}</span>
          <span className="truncate text-small text-text-3">{row.original.uploadedBy}</span>
        </span>
      ),
    },
  ];

  const upload = () => setDialog({ mode: "new" });

  return (
    <>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      <DataTable
        id="documents"
        noun={{ one: "document", many: "documents" }}
        columns={columns}
        rows={rows}
        total={total}
        getRowId={(r) => r.id}
        params={params}
        defaults={DOCUMENTS_TABLE}
        searchPlaceholder="Search number, title, file or linked asset"
        openRowId={openId}
        onOpenRow={(r) => setOpenId((cur) => (cur === r.id ? null : r.id))}
        empty={
          everyone === 0 ? (
            <TableMessage
              icon={FileText}
              actions={
                <Button onClick={upload}>
                  <Upload aria-hidden /> Upload document
                </Button>
              }
            >
              No documents yet. Upload invoices, warranty cards, user guides and AMC contracts, and link them to assets.
            </TableMessage>
          ) : undefined
        }
        toolbar={
          <>
            <label className="sr-only" htmlFor="documents-type">
              Type
            </label>
            <select
              id="documents-type"
              value={filters.type ?? ""}
              onChange={(e) => setFilter("type", e.target.value)}
              className={cn(inputClass, "h-8 w-auto max-w-44 cursor-pointer pr-8 text-[13px]", filters.type && "border-primary")}
            >
              <option value="">All types</option>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            {(unlinked > 0 || filters.links) && (
              <label className="flex h-8 cursor-pointer items-center gap-2 rounded-sm border border-border-strong px-2.5 text-[13px] has-checked:border-primary has-checked:bg-primary-weak">
                <input
                  type="checkbox"
                  checked={filters.links === "none"}
                  onChange={(e) => setFilter("links", e.target.checked ? "none" : "")}
                  className="size-3.5 accent-(--color-primary)"
                />
                Not linked ({unlinked})
              </label>
            )}
            <Button onClick={upload}>
              <Upload aria-hidden /> Upload document
            </Button>
          </>
        }
        rowMenu={(r) => (
          <>
            <DropdownMenuItem onSelect={() => setOpenId(r.id)}>
              <Eye aria-hidden /> Open details
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={documentFileHref(r.id)} target="_blank" rel="noopener">
                <ExternalLink aria-hidden /> Open file
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={documentFileHref(r.id, true)}>
                <Download aria-hidden /> Download
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog({ mode: "edit", doc: r })}>
              <Pencil aria-hidden /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteId(r.id)}>
              <Trash2 aria-hidden /> Delete…
            </DropdownMenuItem>
          </>
        )}
        renderCard={(r) => (
          <span className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
            <span className="id text-text-3">{r.code}</span>
            <StatusChip tone="neutral" icon={FileText} className="justify-self-end">
              {DOC_TYPE_LABEL[r.docType]}
            </StatusChip>
            <span className="col-span-2 truncate text-sm font-medium">{r.title}</span>
            <span className="col-span-2 text-small text-text-2">
              {linksText(r)} · {formatFileSize(r.fileSize)} · {formatDate(r.createdAt, timeZone)}
            </span>
          </span>
        )}
      />

      <DetailDrawer open={open !== null} onOpenChange={(o) => !o && setOpenId(null)} width={480}>
        {open && (
          <>
            <DrawerHeader
              id={open.code}
              title={open.title}
              chips={<StatusChip tone="neutral" icon={FileText}>{DOC_TYPE_LABEL[open.docType]}</StatusChip>}
              actions={
                <>
                  <a href={documentFileHref(open.id)} target="_blank" rel="noopener" className={buttonVariants()}>
                    <ExternalLink aria-hidden /> Open file
                  </a>
                  <a href={documentFileHref(open.id, true)} className={buttonVariants({ variant: "secondary" })}>
                    <Download aria-hidden /> Download
                  </a>
                  <Button variant="ghost" onClick={() => setDialog({ mode: "edit", doc: open })}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                </>
              }
            />
            <DrawerBody>
              <DrawerSection title="File">
                <DrawerFacts
                  items={[
                    { label: "File", value: open.fileName },
                    { label: "Kind and size", value: `${fileKind(open.fileType)} · ${formatFileSize(open.fileSize)}` },
                    {
                      label: "Uploaded",
                      value: `${formatDate(open.createdAt, timeZone)} ${formatTime(open.createdAt, timeZone)} · ${open.uploadedBy}`,
                    },
                  ]}
                />
              </DrawerSection>
              <DrawerSection title={`Assets (${open.assets.length})`}>
                {open.assets.length === 0 ? (
                  <p className="text-small text-text-3">Not linked to any asset.</p>
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
              <DrawerSection title={`Warranties and AMCs (${open.contracts.length})`}>
                {open.contracts.length === 0 ? (
                  <p className="text-small text-text-3">Not linked to any contract.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {open.contracts.map((c) => (
                      <li key={c.id} className="flex gap-3 text-cell">
                        <span className="id w-20 flex-none">{c.code}</span>
                        <span className="truncate">{c.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </DrawerSection>
              <Button variant="ghost" className="w-fit" onClick={() => setDeleteId(open.id)}>
                <Trash2 aria-hidden /> Delete document
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
        <DocumentDialog
          key={dialog.mode === "new" ? "new" : `edit-${dialog.doc.id}`}
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
        title={`Delete ${deleting?.code ?? "this document"}?`}
        description={
          deletingLinks > 0
            ? `It's attached to ${linksText(deleting!).toLowerCase()}; it will be removed from them. This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete document"
        typeToConfirm={deletingLinks > 0 ? deleting?.code : undefined}
        pending={busy}
        onConfirm={() => {
          const id = deleteId;
          if (!id) return;
          startTransition(async () => {
            const result = await deleteDocument(id);
            setNotice(result);
            setDeleteId(null);
            if (!result.error && openId === id) setOpenId(null);
          });
        }}
      />
    </>
  );
}
