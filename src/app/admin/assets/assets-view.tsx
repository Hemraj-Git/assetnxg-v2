"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Box, Eye, Pencil, Plus, RotateCcw } from "lucide-react";
import { BulkButton, DataTable } from "@/components/data-table/data-table";
import { TableMessage } from "@/components/data-table/table-message";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FormMessage, inputClass } from "@/components/ui/field";
import { ASSET_STATUSES, ASSET_STATUS_LABEL, type AssetStatus } from "@/lib/assets";
import { formatDate } from "@/lib/dates";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { formatCount, type TableParams } from "@/lib/table-params";
import { cn } from "cn";
import { AssetStatusChip, StatusDialog } from "./asset-status";
import { ASSETS_TABLE, NO_FILTERS, type AssetFilters, type AssetRow } from "./assets-table";

type Ref = { id: string; name: string };

export function AssetsView({
  rows,
  total,
  params,
  everyone,
  counts,
  filters,
  refs,
  canAdd,
}: {
  rows: AssetRow[];
  total: number;
  params: TableParams;
  everyone: number;
  counts: Record<AssetStatus, number>;
  filters: AssetFilters;
  refs: {
    campuses: Ref[];
    buildings: (Ref & { campusId: string })[];
    rooms: (Ref & { buildingId: string })[];
    categories: Ref[];
    subCategories: (Ref & { categoryId: string })[];
  };
  canAdd: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [statusFor, setStatusFor] = useState<{ ids: string[]; clear?: () => void } | null>(null);
  const [notice, setNotice] = useState<ActionState>(initialActionState);

  /** Change filters in the address; narrower filters reset when a wider one changes. */
  function setFilter(key: keyof AssetFilters, value: string) {
    const next = new URLSearchParams(window.location.search);
    const reset: Record<string, (keyof AssetFilters)[]> = {
      campus: ["building", "room"],
      building: ["room"],
      category: ["sub"],
    };
    if (value) next.set(key, value);
    else next.delete(key);
    for (const k of reset[key] ?? []) next.delete(k);
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  function clearFilters() {
    const next = new URLSearchParams(window.location.search);
    for (const k of Object.keys(NO_FILTERS)) next.delete(k);
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  const buildings = refs.buildings.filter((b) => !filters.campus || b.campusId === filters.campus);
  const rooms = refs.rooms.filter((r) => (filters.building ? r.buildingId === filters.building : buildings.some((b) => b.id === r.buildingId)));
  const subs = refs.subCategories.filter((s) => !filters.category || s.categoryId === filters.category);
  const anyFilter = Object.entries(filters).some(([k, v]) => k !== "status" && v);
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const columns: ColumnDef<AssetRow, unknown>[] = [
    {
      id: "code",
      header: "ID",
      meta: { priority: 0, sticky: true },
      cell: ({ row }) => <span className="id">{row.original.code}</span>,
    },
    {
      id: "name",
      header: "Name",
      meta: { priority: 0 },
      cell: ({ row }) => (
        <Link href={`/admin/assets/${row.original.code}`} className="block max-w-[260px] truncate font-medium text-text no-underline hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    {
      id: "category",
      header: "Category › sub-category",
      meta: { priority: 2, label: "Category" },
      cell: ({ row }) => <span className="block max-w-[240px] truncate text-text-2">{row.original.category}</span>,
    },
    {
      id: "location",
      header: "Location",
      meta: { priority: 1 },
      cell: ({ row }) => <span className="block max-w-[260px] truncate text-text-2">{row.original.location}</span>,
    },
    {
      id: "status",
      header: "Status",
      meta: { priority: 1 },
      cell: ({ row }) => <AssetStatusChip status={row.original.status} />,
    },
    {
      id: "installed",
      header: "Installed",
      meta: { priority: 4 },
      cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.installationDate) || "—"}</span>,
    },
  ];

  const select = (id: string, label: string, value: string | null, options: Ref[], all: string, key: keyof AssetFilters) =>
    options.length > 0 && (
      <span className="contents">
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
        <select
          id={id}
          value={value ?? ""}
          onChange={(e) => setFilter(key, e.target.value)}
          className={cn(inputClass, "h-8 w-auto max-w-44 cursor-pointer pr-8 text-[13px]", value && "border-primary")}
        >
          <option value="">{all}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </span>
    );

  return (
    <>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      <nav aria-label="Asset status" className="flex gap-1 overflow-x-auto border-b border-border">
        {[null, ...ASSET_STATUSES].map((s) => {
          const on = filters.status === s;
          const count = s ? counts[s] : allCount;
          return (
            <button
              key={s ?? "all"}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => setFilter("status", s ?? "")}
              className={cn(
                "-mb-px flex flex-none items-center gap-1.5 border-b-2 px-3 py-2 text-[13.5px] font-medium",
                on ? "border-primary text-text" : "border-transparent text-text-2 hover:border-border-strong hover:text-text",
              )}
            >
              {s ? ASSET_STATUS_LABEL[s] : "All"}
              <span className="rounded-xs bg-sunken px-1.5 text-xs leading-[18px] text-text-2 tabular-nums">{formatCount(count)}</span>
            </button>
          );
        })}
      </nav>

      <DataTable
        id="assets"
        noun={{ one: "asset", many: "assets" }}
        columns={columns}
        rows={rows}
        total={total}
        getRowId={(r) => r.id}
        params={params}
        defaults={ASSETS_TABLE}
        searchPlaceholder="Search ID, name, serial or place"
        onOpenRow={(r) => router.push(`/admin/assets/${r.code}`)}
        empty={
          everyone === 0 ? (
            <TableMessage
              icon={Box}
              actions={
                canAdd ? (
                  <Button asChild>
                    <Link href="/admin/assets/new">
                      <Plus aria-hidden /> Add asset
                    </Link>
                  </Button>
                ) : undefined
              }
            >
              No assets yet. Add the equipment you maintain; each gets an AST- number and a QR code.
            </TableMessage>
          ) : undefined
        }
        toolbar={
          <>
            {select("f-campus", "Campus", filters.campus, refs.campuses, "All campuses", "campus")}
            {select("f-building", "Building", filters.building, buildings, "All buildings", "building")}
            {filters.building && select("f-room", "Room", filters.room, rooms, "All rooms", "room")}
            {select("f-category", "Category", filters.category, refs.categories, "All categories", "category")}
            {filters.category && select("f-sub", "Sub-category", filters.sub, subs, "All sub-categories", "sub")}
            {anyFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <RotateCcw aria-hidden /> Reset filters
              </Button>
            )}
          </>
        }
        rowMenu={(r) => (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/admin/assets/${r.code}`}>
                <Eye aria-hidden /> Open
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/assets/${r.code}/edit`}>
                <Pencil aria-hidden /> Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setStatusFor({ ids: [r.id] })}>
              <ArrowUpDown aria-hidden /> Change status…
            </DropdownMenuItem>
          </>
        )}
        bulkActions={(ids, clear) => (
          <BulkButton onClick={() => setStatusFor({ ids, clear })}>
            <ArrowUpDown aria-hidden /> Change status
          </BulkButton>
        )}
        renderCard={(r) => (
          <span className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
            <span className="id text-text-3">{r.code}</span>
            <AssetStatusChip status={r.status} className="justify-self-end" />
            <span className="col-span-2 text-sm font-medium">{r.name}</span>
            <span className="col-span-2 truncate text-small text-text-2">{r.location}</span>
          </span>
        )}
      />

      {statusFor && (
        <StatusDialog
          ids={statusFor.ids}
          onClose={() => setStatusFor(null)}
          onDone={(result) => {
            setNotice(result);
            if (!result.error) {
              statusFor.clear?.();
              setStatusFor(null);
            }
          }}
        />
      )}
    </>
  );
}
