"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Plus, Trash2, Truck } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CheckboxRow, FormMessage, TextField, inputClass } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import type { TableParams } from "@/lib/table-params";
import { deleteVendor, saveVendor } from "./actions";
import type { CategoryOption } from "./data";
import { VENDORS_TABLE, type VendorRow } from "./vendors-table";

export function VendorsView({
  rows,
  total,
  params,
  everyone,
  category,
  categories,
}: {
  rows: VendorRow[];
  total: number;
  params: TableParams;
  everyone: number;
  category: string | null;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ vendor: VendorRow | null } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionState>(initialActionState);
  const [busy, startTransition] = useTransition();

  const index = rows.findIndex((r) => r.id === openId);
  const open = index >= 0 ? rows[index] : null;
  const deleting = rows.find((r) => r.id === deleteId) ?? null;

  function setCategory(value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set("category", value);
    else next.delete("category");
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  const columns: ColumnDef<VendorRow, unknown>[] = [
    {
      id: "code",
      header: "Number",
      meta: { priority: 0, sticky: true },
      cell: ({ row }) => <span className="id">{row.original.code}</span>,
    },
    {
      id: "name",
      header: "Name",
      meta: { priority: 0 },
      cell: ({ row }) => <span className="block max-w-[260px] truncate font-medium">{row.original.name}</span>,
    },
    {
      id: "supplies",
      header: "Supplies",
      meta: { priority: 2 },
      cell: ({ row }) => (
        <span className="block max-w-[240px] truncate text-text-2">{row.original.supplies.join(", ") || "—"}</span>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      meta: { priority: 1 },
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{row.original.contactPerson ?? "—"}</span>
          {row.original.phone && <span className="truncate text-small text-text-3 tabular-nums">{row.original.phone}</span>}
        </span>
      ),
    },
  ];

  return (
    <>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      <DataTable
        id="vendors"
        noun={{ one: "vendor", many: "vendors" }}
        columns={columns}
        rows={rows}
        total={total}
        getRowId={(r) => r.id}
        params={params}
        defaults={VENDORS_TABLE}
        searchPlaceholder="Search by name, number, what they supply or contact"
        openRowId={openId}
        onOpenRow={(r) => setOpenId((cur) => (cur === r.id ? null : r.id))}
        empty={
          everyone === 0 ? (
            <TableMessage
              icon={Truck}
              actions={
                <Button onClick={() => setEditing({ vendor: null })}>
                  <Plus aria-hidden /> Add vendor
                </Button>
              }
            >
              No vendors yet. Add the companies you buy from and the ones that service your assets.
            </TableMessage>
          ) : undefined
        }
        toolbar={
          <>
            {categories.length > 0 && (
              <>
                <label className="sr-only" htmlFor="vendors-category">
                  Supplies
                </label>
                <select
                  id="vendors-category"
                  value={category ?? ""}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`${inputClass} h-8 w-auto max-w-56 cursor-pointer pr-8 text-[13px]`}
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <Button onClick={() => setEditing({ vendor: null })}>
              <Plus aria-hidden /> Add vendor
            </Button>
          </>
        }
        rowMenu={(r) => (
          <>
            <DropdownMenuItem onSelect={() => setOpenId(r.id)}>
              <Eye aria-hidden /> Open details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditing({ vendor: r })}>
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
            <span />
            <span className="col-span-2 text-sm font-medium">{r.name}</span>
            <span className="col-span-2 truncate text-small text-text-2">
              {[r.supplies.join(", "), r.contactPerson, r.phone].filter(Boolean).join(" · ")}
            </span>
          </span>
        )}
      />

      <DetailDrawer open={open !== null} onOpenChange={(o) => !o && setOpenId(null)} width={480}>
        {open && (
          <>
            <DrawerHeader
              id={open.code}
              title={open.name}
              actions={
                <>
                  <Button onClick={() => setEditing({ vendor: open })}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                  <Button variant="ghost" onClick={() => setDeleteId(open.id)}>
                    <Trash2 aria-hidden /> Delete
                  </Button>
                </>
              }
            />
            <DrawerBody>
              <DrawerSection title="Contact">
                <DrawerFacts
                  items={[
                    { label: "Contact person", value: open.contactPerson ?? "—" },
                    { label: "Phone", value: open.phone ? <a href={`tel:${open.phone.replace(/\s/g, "")}`}>{open.phone}</a> : "—" },
                    { label: "Email", value: open.email ? <a href={`mailto:${open.email}`}>{open.email}</a> : "—" },
                    { label: "Address", value: open.address ?? "—" },
                    { label: "Supplies", value: open.supplies.join(", ") || "—" },
                  ]}
                />
              </DrawerSection>
              <DrawerSection title="Contracts and assets">
                <p className="text-small text-text-2">
                  AMC and warranty contracts with this vendor, and the assets they cover, appear here once assets are
                  added. Jobs and repairs follow with their modules.
                </p>
              </DrawerSection>
            </DrawerBody>
            <DrawerFooter
              position={`${index + 1} of ${rows.length} on this page`}
              onPrevious={index > 0 ? () => setOpenId(rows[index - 1].id) : undefined}
              onNext={index < rows.length - 1 ? () => setOpenId(rows[index + 1].id) : undefined}
            />
          </>
        )}
      </DetailDrawer>

      {editing && (
        <VendorDialog
          key={editing.vendor?.id ?? "new"}
          vendor={editing.vendor}
          categories={categories}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setNotice({ error: null, success: message });
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={`Delete ${deleting?.name ?? "this vendor"}?`}
        description="This can't be undone. Vendors linked to assets, contracts, spares or jobs can't be deleted once those are in use."
        confirmLabel="Delete vendor"
        typeToConfirm={deleting?.code}
        pending={busy}
        onConfirm={() => {
          const id = deleteId;
          if (!id) return;
          startTransition(async () => {
            const result = await deleteVendor(id);
            setNotice(result);
            setDeleteId(null);
            if (!result.error && openId === id) setOpenId(null);
          });
        }}
      />
    </>
  );
}

function VendorDialog({
  vendor,
  categories,
  onClose,
  onDone,
}: {
  vendor: VendorRow | null;
  categories: CategoryOption[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveVendor(vendor?.id ?? null, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initialActionState);

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="lg">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">{vendor ? `Edit ${vendor.name}` : "Add vendor"}</DialogTitle>
            <DialogDescription>{vendor ? vendor.code : "The number (VND-…) is given when you save."}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <TextField label="Name" name="name" required maxLength={120} defaultValue={vendor?.name ?? ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Contact person" name="contact_person" optional maxLength={120} defaultValue={vendor?.contactPerson ?? ""} />
              <TextField label="Phone" name="phone" type="tel" optional maxLength={20} defaultValue={vendor?.phone ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Email" name="email" type="email" optional maxLength={254} defaultValue={vendor?.email ?? ""} />
              <TextField label="Address" name="address" optional maxLength={300} defaultValue={vendor?.address ?? ""} />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] leading-[18px] font-medium">
                Supplies <span className="text-xs font-normal text-text-3">(optional)</span>
              </legend>
              {categories.length === 0 ? (
                <p className="text-small text-text-3">
                  Add <Link href="/admin/categories">categories</Link> first to say what this vendor supplies or services.
                </p>
              ) : (
                <div className="grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {categories.map((c) => (
                    <CheckboxRow
                      key={c.id}
                      name="category_ids"
                      value={c.id}
                      title={c.name}
                      description={c.code}
                      defaultChecked={vendor?.categoryIds.includes(c.id) ?? false}
                    />
                  ))}
                </div>
              )}
            </fieldset>

            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {vendor ? "Save" : "Add vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
