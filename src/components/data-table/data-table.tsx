"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowData,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  MoreHorizontal,
  Rows3,
  Rows4,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PAGE_SIZES,
  formatCount,
  nextSort,
  pageCount,
  pageWindow,
  rangeLabel,
  withTableParams,
  type PageSize,
  type TableDefaults,
  type TableParams,
} from "@/lib/table-params";
import { useLocalPreference } from "@/lib/use-local-preference";
import { TableMessage } from "./table-message";

// Canvas · Patterns › Data table. One component for every list:
// - pages choose the columns; each column says how important it is
//   (priority) so narrow screens drop the least important first;
// - sort, search, page and page size live in the URL, so the server page
//   fetches just the rows shown and links / Back work;
// - selection, the bulk bar, the row menu, density, the column chooser and
//   the keyboard rules are the same everywhere.
// Saved views, filters and export join with the first real list (Phase 2).

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** 0 = always shown. 1–4 drop out as the screen narrows:
     *  4 below 1440px, 3 below 1280px, 2 below 1024px. */
    priority?: 0 | 1 | 2 | 3 | 4;
    /** Numbers and amounts align right. */
    align?: "start" | "end";
    /** Name in the column chooser (when the header isn't plain text). */
    label?: string;
    /** Stays in view when the table scrolls sideways (the ID column). */
    sticky?: boolean;
    /** Off until the person turns it on in the column chooser. */
    hiddenByDefault?: boolean;
  }
}

const PRIORITY_CLASS: Record<number, string> = {
  0: "",
  1: "",
  2: "max-lg:hidden",
  3: "max-xl:hidden",
  4: "max-[1439px]:hidden",
};

export type DataTableProps<T> = {
  /** Remembers this table's columns and density, e.g. "assets". */
  id: string;
  /** For screen readers and messages: { one: "asset", many: "assets" }. */
  noun: { one: string; many: string };
  columns: ColumnDef<T, unknown>[];
  /** The rows of the current page. */
  rows: T[];
  /** Rows matching the search and filters, across all pages. */
  total: number;
  getRowId: (row: T) => string;
  /** URL state as parsed on the server page (parseTableParams). */
  params: TableParams;
  defaults: TableDefaults;
  searchPlaceholder?: string;
  /** Enter, click or tap on a row: open its drawer. */
  onOpenRow?: (row: T) => void;
  /** The row whose drawer is open: stays highlighted. */
  openRowId?: string | null;
  /** Row menu (⋯) items: DropdownMenuItem elements. */
  rowMenu?: (row: T) => ReactNode;
  /** Turns on selection; renders the bulk bar's buttons (use BulkButton). */
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode;
  /** Phone layout: one card per row below 768px. */
  renderCard?: (row: T) => ReactNode;
  /** Shown when there are no rows at all yet (not because of a search). */
  empty?: ReactNode;
  /** Extra toolbar content (filters, export) left of the view controls. */
  toolbar?: ReactNode;
};

type Density = "comfortable" | "compact";

export function DataTable<T>({
  id,
  noun,
  columns,
  rows,
  total,
  getRowId,
  params,
  defaults,
  searchPlaceholder,
  onOpenRow,
  openRowId,
  rowMenu,
  bulkActions,
  renderCard,
  empty,
  toolbar,
}: DataTableProps<T>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const selectable = Boolean(bulkActions);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [density, setDensity] = useLocalPreference<Density>(
    "assetnxg-density",
    (raw) => (raw === "compact" ? "compact" : "comfortable"),
    "comfortable",
  );

  // Column chooser: "default", or "h:" + the ids the person hid.
  const [colPref, setColPref] = useLocalPreference<string>(
    `assetnxg-cols-${id}`,
    (raw) => (raw && raw.startsWith("h:") ? raw : "default"),
    "default",
  );
  const hiddenIds =
    colPref === "default"
      ? columns.filter((c) => c.meta?.hiddenByDefault).map((c) => c.id ?? "")
      : colPref.slice(2).split(",").filter(Boolean);
  const columnVisibility = Object.fromEntries(hiddenIds.map((h) => [h, false]));

  // TanStack Table v8 returns functions React Compiler can't memoise safely,
  // so the compiler skips this component; that's expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => getRowId(row),
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    enableRowSelection: selectable,
    state: { rowSelection, columnVisibility },
    onRowSelectionChange: setRowSelection,
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const clearSelection = () => setRowSelection({});

  function update(change: Partial<TableParams>) {
    const next = withTableParams(new URLSearchParams(window.location.search), change, defaults);
    const qs = next.toString();
    startTransition(() => {
      router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  }

  // ── Keyboard: one tab stop for the rows (roving tabindex) ─────────────
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const tableRows = table.getRowModel().rows;
  const safeFocus = Math.min(focusIndex, Math.max(0, tableRows.length - 1));

  function onRowKey(e: KeyboardEvent<HTMLTableRowElement>, row: Row<T>, index: number) {
    if (e.target !== e.currentTarget) return; // keys inside a menu or checkbox
    const move = (to: number) => {
      const i = Math.max(0, Math.min(tableRows.length - 1, to));
      setFocusIndex(i);
      rowRefs.current[i]?.focus();
    };
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(index + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(tableRows.length - 1);
    } else if (e.key === " " && selectable) {
      e.preventDefault();
      row.toggleSelected();
    } else if (e.key === "Enter" && onOpenRow) {
      e.preventDefault();
      onOpenRow(row.original);
    } else if (e.key === "Escape" && selectedIds.length > 0) {
      clearSelection();
    }
  }

  function onRowClick(e: MouseEvent, row: Row<T>, index: number) {
    if ((e.target as HTMLElement).closest("button, a, input, label, [role='menuitem']")) return;
    setFocusIndex(index);
    onOpenRow?.(row.original);
  }

  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const stickyLeft = selectable ? "left-11" : "left-0";
  const compact = density === "compact";
  const hasRows = tableRows.length > 0;
  const pages = pageCount(total, params.size);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox
          value={params.q}
          placeholder={searchPlaceholder ?? `Search ${noun.many}`}
          onSearch={(q) => update({ q })}
        />
        {toolbar}
        <span className="flex-1" />
        <div className="flex items-center gap-2 max-md:hidden">
          <div role="group" aria-label="Row height" className="inline-flex gap-0.5 rounded-sm border border-border bg-sunken p-0.5">
            <SegButton on={!compact} label="Comfortable rows" onClick={() => setDensity("comfortable")}>
              <Rows3 aria-hidden className="size-4" />
            </SegButton>
            <SegButton on={compact} label="Compact rows" onClick={() => setDensity("compact")}>
              <Rows4 aria-hidden className="size-4" />
            </SegButton>
          </div>
          <ColumnChooser
            columns={columns}
            hiddenIds={hiddenIds}
            onChange={(ids) => setColPref(`h:${ids.join(",")}`)}
            onReset={() => setColPref("default")}
          />
        </div>
      </div>

      {/* ── Table box ── */}
      <div className="flex min-w-0 flex-col overflow-hidden rounded-md border border-border bg-surface">
        {!hasRows ? (
          total === 0 && params.q ? (
            <TableMessage
              icon={SearchX}
              actions={
                <Button variant="secondary" onClick={() => update({ q: "" })}>
                  Clear search
                </Button>
              }
            >
              No {noun.many} match <b className="font-semibold text-text">“{params.q}”</b>.
            </TableMessage>
          ) : (
            (empty ?? <TableMessage icon={SearchX}>No {noun.many} yet.</TableMessage>)
          )
        ) : (
          <>
            {/* Phones: cards */}
            {renderCard && (
              <ul aria-label={noun.many} className={cn("md:hidden", pending && "opacity-60")}>
                {tableRows.map((row) => {
                  const open = openRowId === row.id;
                  return (
                    <li key={row.id} className="border-b border-border last:border-b-0">
                      {onOpenRow ? (
                        <button
                          type="button"
                          onClick={() => onOpenRow(row.original)}
                          className={cn("block w-full px-4 py-3 text-left", open ? "bg-primary-weak" : "bg-surface")}
                        >
                          {renderCard(row.original)}
                        </button>
                      ) : (
                        <div className="px-4 py-3">{renderCard(row.original)}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Tablets and desktops: the table. Only this box scrolls sideways. */}
            <div className={cn("max-h-[min(70dvh,960px)] min-w-0 overflow-auto", renderCard && "max-md:hidden")}>
              <table
                aria-label={noun.many}
                aria-rowcount={total + 1}
                aria-busy={pending || undefined}
                className="w-full border-separate border-spacing-0 text-cell"
              >
                <thead>
                  <tr>
                    {selectable && (
                      <th
                        scope="col"
                        className={cn(
                          "sticky top-0 left-0 z-3 w-11 border-b border-border bg-surface pl-4",
                          compact ? "h-8" : "h-9",
                        )}
                      >
                        <Checkbox
                          label={`Select all ${noun.many} on this page`}
                          checked={table.getIsAllRowsSelected()}
                          mixed={table.getIsSomeRowsSelected()}
                          onChange={() => table.toggleAllRowsSelected(!table.getIsAllRowsSelected())}
                        />
                      </th>
                    )}
                    {headers.map((h) => {
                      const column = h.column;
                      const meta = column.columnDef.meta ?? {};
                      const sortable = defaults.sortable.includes(column.id);
                      const sorted = params.sort === column.id ? params.dir : null;
                      const header = flexRender(column.columnDef.header, h.getContext());
                      return (
                        <th
                          key={column.id}
                          scope="col"
                          aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                          className={cn(
                            "sticky top-0 z-2 border-b border-border bg-surface px-3 text-[12.5px] font-medium whitespace-nowrap",
                            compact ? "h-8" : "h-9",
                            sorted ? "text-text" : "text-text-2",
                            meta.align === "end" ? "text-right" : "text-left",
                            meta.sticky && cn(stickyLeft, "z-3 shadow-[1px_0_0_var(--color-border)]"),
                            PRIORITY_CLASS[meta.priority ?? 1],
                          )}
                        >
                          {sortable ? (
                            <button
                              type="button"
                              onClick={() => update(nextSort({ sort: params.sort, dir: params.dir }, column.id))}
                              className={cn(
                                "-mx-1 inline-flex items-center gap-1 rounded-xs px-1 py-0.5 hover:bg-sunken hover:text-text",
                                meta.align === "end" && "flex-row-reverse",
                              )}
                            >
                              {header}
                              {sorted === "asc" ? (
                                <ArrowUp aria-hidden className="size-3.5" />
                              ) : sorted === "desc" ? (
                                <ArrowDown aria-hidden className="size-3.5" />
                              ) : (
                                <ArrowUpDown aria-hidden className="size-3.5 text-text-3" />
                              )}
                            </button>
                          ) : (
                            header
                          )}
                        </th>
                      );
                    })}
                    {rowMenu && (
                      <th scope="col" className={cn("sticky top-0 z-2 w-11 border-b border-border bg-surface", compact ? "h-8" : "h-9")}>
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className={cn("transition-opacity duration-(--dur-2)", pending && "opacity-60")}>
                  {tableRows.map((row, index) => {
                    const selected = row.getIsSelected();
                    const open = openRowId === row.id;
                    return (
                      <tr
                        key={row.id}
                        ref={(el) => {
                          rowRefs.current[index] = el;
                        }}
                        tabIndex={index === safeFocus ? 0 : -1}
                        aria-selected={selectable ? selected : undefined}
                        data-open={open || undefined}
                        onKeyDown={(e) => onRowKey(e, row, index)}
                        onClick={(e) => onRowClick(e, row, index)}
                        className={cn(
                          "group/row outline-none focus-visible:[&>td]:shadow-[inset_0_2px_0_var(--color-focus),inset_0_-2px_0_var(--color-focus)]",
                          onOpenRow && "cursor-pointer",
                          "[&>td]:bg-surface hover:[&>td]:bg-row-hover",
                          (selected || open) && "[&>td]:bg-primary-weak hover:[&>td]:bg-primary-weak",
                          open && "[&>td:first-child]:shadow-[inset_2px_0_0_var(--color-primary)]",
                        )}
                      >
                        {selectable && (
                          <td className={cn("sticky left-0 z-1 w-11 border-b border-border pl-4 group-last/row:border-b-0", compact ? "h-9" : "h-11")}>
                            <Checkbox
                              label={`Select ${getRowId(row.original)}`}
                              checked={selected}
                              onChange={() => row.toggleSelected()}
                            />
                          </td>
                        )}
                        {row.getVisibleCells().map((cell) => {
                          const meta = cell.column.columnDef.meta ?? {};
                          return (
                            <td
                              key={cell.id}
                              className={cn(
                                "border-b border-border px-3 whitespace-nowrap group-last/row:border-b-0",
                                compact ? "h-9" : "h-11",
                                meta.align === "end" && "text-right tabular-nums",
                                meta.sticky && cn("sticky z-1 shadow-[1px_0_0_var(--color-border)]", stickyLeft),
                                PRIORITY_CLASS[meta.priority ?? 1],
                              )}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                        {rowMenu && (
                          <td className={cn("w-11 border-b border-border px-1.5 text-center group-last/row:border-b-0", compact ? "h-9" : "h-11")}>
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${getRowId(row.original)}`}>
                                  <MoreHorizontal aria-hidden />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[220px]">
                                {rowMenu(row.original)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Footer: page size, range, pager ── */}
            <div className="flex flex-wrap items-center gap-3 border-t border-border py-2 pr-3 pl-4 text-[13px] text-text-2">
              <span className="max-sm:hidden">Rows per page</span>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" aria-label={`Rows per page: ${params.size}`}>
                    {params.size}
                    <ChevronDown aria-hidden className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-28">
                  <DropdownMenuRadioGroup
                    value={String(params.size)}
                    onValueChange={(v) => update({ size: Number(v) as PageSize })}
                  >
                    {PAGE_SIZES.map((s) => (
                      <DropdownMenuRadioItem key={s} value={String(s)}>
                        {s}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="flex-1" />
              <span className="tabular-nums" aria-live="polite">
                {rangeLabel(params.page, params.size, total)}
              </span>
              {pages > 1 && (
                <nav aria-label="Pages" className="inline-flex items-center gap-1">
                  <PagerButton
                    label="Previous page"
                    disabled={params.page <= 1}
                    onClick={() => update({ page: params.page - 1 })}
                  >
                    <ChevronLeft aria-hidden className="size-4" />
                  </PagerButton>
                  {pageWindow(params.page, pages).map((p, i) =>
                    p === "gap" ? (
                      <span key={`gap-${i}`} aria-hidden className="px-1 text-text-3">
                        …
                      </span>
                    ) : (
                      <PagerButton
                        key={p}
                        label={`Page ${p}`}
                        current={p === params.page}
                        onClick={() => update({ page: p })}
                        className="max-sm:hidden"
                      >
                        {formatCount(p)}
                      </PagerButton>
                    ),
                  )}
                  <PagerButton
                    label="Next page"
                    disabled={params.page >= pages}
                    onClick={() => update({ page: params.page + 1 })}
                  >
                    <ChevronRight aria-hidden className="size-4" />
                  </PagerButton>
                </nav>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Bulk bar: rises above the foot once a row is selected ── */}
      {selectable && selectedIds.length > 0 && (
        <div className="sticky bottom-4 z-(--z-sticky) flex justify-center">
          <div
            role="toolbar"
            aria-label={`Actions for ${selectedIds.length} selected ${selectedIds.length === 1 ? noun.one : noun.many}`}
            onKeyDown={(e) => e.key === "Escape" && clearSelection()}
            className="inline-flex animate-in items-center gap-1 rounded-md bg-[#0F172A] py-1.5 pr-1.5 pl-3.5 text-[13px] text-[#E6EAF2] shadow-3 duration-(--dur-3) fade-in slide-in-from-bottom-4 dark:bg-[#E6EAF2] dark:text-[#0F172A]"
          >
            <span className="font-semibold tabular-nums">{formatCount(selectedIds.length)} selected</span>
            <span aria-hidden className="mx-1.5 h-[18px] w-px bg-current opacity-20" />
            {bulkActions?.(selectedIds, clearSelection)}
            <span aria-hidden className="mx-1.5 h-[18px] w-px bg-current opacity-20" />
            <BulkButton aria-label="Clear selection" onClick={clearSelection}>
              <X aria-hidden className="size-4" />
            </BulkButton>
          </div>
        </div>
      )}
    </div>
  );
}

/** A button for the bulk bar (dark surface). */
export function BulkButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-[30px] items-center gap-1.5 rounded-xs px-2.5 text-[13px] font-medium hover:bg-white/10 dark:hover:bg-black/10 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function SearchBox({
  value,
  placeholder,
  onSearch,
}: {
  value: string;
  placeholder: string;
  onSearch: (q: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [text, setText] = useState(value);
  // Follow the URL when it changes from outside (Back button, Clear search),
  // adjusting state during render rather than in an effect.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== text.trim()) setText(value);
  }

  // "/" focuses the search (canvas keyboard rules).
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer.current);
    };
  }, []);

  function schedule(next: string) {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next.trim()), 300);
  }

  return (
    <div className="flex h-8 w-[280px] items-center gap-2 rounded-sm border border-border-strong bg-surface px-2.5 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus max-md:h-9 max-md:flex-1">
      <Search aria-hidden className="size-4 flex-none text-text-3" />
      <input
        ref={input}
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-keyshortcuts="/"
        onChange={(e) => schedule(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            clearTimeout(timer.current);
            onSearch(text.trim());
          }
        }}
        className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-text-3 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            clearTimeout(timer.current);
            setText("");
            onSearch("");
            input.current?.focus();
          }}
          className="flex size-5 items-center justify-center rounded-xs text-text-3 hover:bg-sunken hover:text-text"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  mixed = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  mixed?: boolean;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = mixed && !checked;
      }}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="block size-4 cursor-pointer accent-(--color-primary)"
    />
  );
}

function SegButton({
  on,
  label,
  onClick,
  children,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-8 items-center justify-center rounded-xs text-text-2",
        on && "bg-surface text-text shadow-1 dark:bg-raised",
      )}
    >
      {children}
    </button>
  );
}

function PagerButton({
  label,
  current = false,
  disabled = false,
  onClick,
  className,
  children,
}: {
  label: string;
  current?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-xs border border-transparent px-1.5 text-[13px] text-text-2 tabular-nums hover:bg-sunken disabled:pointer-events-none disabled:opacity-40",
        current && "border-border-strong bg-surface font-semibold text-text",
        current ? "" : className,
      )}
    >
      {children}
    </button>
  );
}

function ColumnChooser<T>({
  columns,
  hiddenIds,
  onChange,
  onReset,
}: {
  columns: ColumnDef<T, unknown>[];
  hiddenIds: string[];
  onChange: (hidden: string[]) => void;
  onReset: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          <Columns3 aria-hidden />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-60 p-1" aria-label="Choose columns">
        <DropdownMenuLabelLike>Shown</DropdownMenuLabelLike>
        <ul className="flex flex-col">
          {columns.map((c) => {
            const colId = c.id ?? "";
            const always = (c.meta?.priority ?? 1) === 0;
            const shown = !hiddenIds.includes(colId);
            const label = c.meta?.label ?? (typeof c.header === "string" ? c.header : colId);
            return (
              <li key={colId}>
                <label
                  className={cn(
                    "flex min-h-8 items-center gap-2.5 rounded-xs px-2 text-[13.5px]",
                    always ? "text-text-3" : "cursor-pointer hover:bg-sunken",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={shown}
                    disabled={always}
                    onChange={() =>
                      onChange(shown ? [...hiddenIds, colId] : hiddenIds.filter((h) => h !== colId))
                    }
                    className="size-4 accent-(--color-primary)"
                  />
                  <span className="flex-1">{label}</span>
                  {always && <span className="text-xs">Always</span>}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 border-t border-border p-1">
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset to default
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DropdownMenuLabelLike({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pt-2 pb-1 text-[11.5px] font-semibold tracking-[.03em] text-text-3 uppercase">
      {children}
    </div>
  );
}
