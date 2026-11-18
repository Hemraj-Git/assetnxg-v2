"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Package, Pencil, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { TableMessage } from "@/components/data-table/table-message";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { inputClass } from "@/components/ui/field";
import { currencySymbol, formatAmount } from "@/lib/money";
import { DEFAULT_MIN_STOCK } from "@/lib/spares";
import { type TableParams } from "@/lib/table-params";
import { cn } from "cn";
import type { SpareRow } from "./data";
import { SPARES_TABLE, type SpareFilters } from "./spares-table";
import { StockChip } from "./stock-chip";

export function SparesView({
  rows,
  total,
  params,
  everyone,
  low,
  out,
  filters,
  categories,
  canAdd,
}: {
  rows: SpareRow[];
  total: number;
  params: TableParams;
  everyone: number;
  low: number;
  out: number;
  filters: SpareFilters;
  categories: { id: string; name: string }[];
  canAdd: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function setFilter(key: keyof SpareFilters, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  const columns: ColumnDef<SpareRow, unknown>[] = [
    { id: "code", header: "Number", meta: { priority: 0, sticky: true }, cell: ({ row }) => <span className="id">{row.original.code}</span> },
    {
      id: "name",
      header: "Spare",
      meta: { priority: 0 },
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col">
          <Link href={`/admin/spares/${row.original.code}`} className="block max-w-[260px] truncate font-medium text-text no-underline hover:underline">
            {row.original.name}
          </Link>
          {row.original.make && <span className="max-w-[260px] truncate text-small text-text-3">{row.original.make}</span>}
        </span>
      ),
    },
    {
      id: "category",
      header: "Category",
      meta: { priority: 2 },
      cell: ({ row }) => <span className="block max-w-[200px] truncate text-text-2">{row.original.category}</span>,
    },
    {
      id: "stock",
      header: "Stock",
      meta: { priority: 0 },
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="w-12 text-right font-medium tabular-nums">{row.original.quantity.toLocaleString("en-IN")}</span>
          {row.original.state !== "ok" ? (
            <StockChip state={row.original.state} />
          ) : (
            <span className="text-small text-text-3">min {row.original.minStock ?? DEFAULT_MIN_STOCK}</span>
          )}
        </span>
      ),
    },
    {
      id: "value",
      header: "Value",
      meta: { priority: 2, align: "end" },
      cell: ({ row }) => (
        <span className="text-text-2 tabular-nums">
          {row.original.value !== null ? `${currencySymbol()} ${formatAmount(row.original.value)}` : "—"}
        </span>
      ),
    },
    {
      id: "storage",
      header: "Stored at",
      meta: { priority: 1 },
      cell: ({ row }) => <span className="block max-w-[220px] truncate text-text-2">{row.original.storage || "—"}</span>,
    },
  ];

  const tabs: { key: SpareFilters["stock"]; label: string; count?: number }[] = [
    { key: null, label: "All" },
    { key: "low", label: "Low stock", count: low + out },
    { key: "out", label: "Out of stock", count: out },
  ];

  return (
    <>
      <nav aria-label="Stock" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => {
          const on = filters.stock === t.key;
          return (
            <button
              key={t.key ?? "all"}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => setFilter("stock", t.key ?? "")}
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
        id="spares"
        noun={{ one: "spare", many: "spares" }}
        columns={columns}
        rows={rows}
        total={total}
        getRowId={(r) => r.id}
        params={params}
        defaults={SPARES_TABLE}
        searchPlaceholder="Search number, name, make, part or place"
        onOpenRow={(r) => router.push(`/admin/spares/${r.code}`)}
        empty={
          everyone === 0 ? (
            <TableMessage
              icon={Package}
              actions={
                canAdd ? (
                  <Button asChild>
                    <Link href="/admin/spares/new">
                      <Plus aria-hidden /> Add spare
                    </Link>
                  </Button>
                ) : undefined
              }
            >
              No spares yet. Add the parts and equipment you keep in store, with how many are in stock.
            </TableMessage>
          ) : undefined
        }
        toolbar={
          <>
            <label className="sr-only" htmlFor="spares-category">
              Category
            </label>
            <select
              id="spares-category"
              value={filters.category ?? ""}
              onChange={(e) => setFilter("category", e.target.value)}
              className={cn(inputClass, "h-8 w-auto max-w-48 cursor-pointer pr-8 text-[13px]", filters.category && "border-primary")}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        }
        rowMenu={(r) => (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/admin/spares/${r.code}`}>
                <Eye aria-hidden /> Open
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/spares/${r.code}/edit`}>
                <Pencil aria-hidden /> Edit
              </Link>
            </DropdownMenuItem>
          </>
        )}
        renderCard={(r) => (
          <span className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
            <span className="id text-text-3">{r.code}</span>
            <StockChip state={r.state} className="justify-self-end" />
            <span className="col-span-2 truncate text-sm font-medium">{r.name}</span>
            <span className="col-span-2 text-small text-text-2 tabular-nums">
              {r.quantity.toLocaleString("en-IN")} in stock{r.storage ? ` · ${r.storage}` : ""}
            </span>
          </span>
        )}
      />
    </>
  );
}
