import type { StockState } from "@/lib/spares";
import type { TableDefaults } from "@/lib/table-params";
import type { SpareRow } from "./data";

// The spares list: search, sort and filters. Shared by the server page and
// the table.

export const SPARES_TABLE: TableDefaults = {
  sortable: ["code", "name", "category", "stock", "value", "storage"],
  sort: "code",
  dir: "asc",
};

const STATE_ORDER: Record<StockState, number> = { out: 0, low: 1, ok: 2 };

export function spareSearchText(s: SpareRow): string {
  return [s.code, s.name, s.make, s.category, s.storage, s.vendor ?? ""].join(" ");
}

export function spareSortValue(s: SpareRow, column: string): string | number | null {
  switch (column) {
    case "code":
      return s.code;
    case "name":
      return s.name;
    case "category":
      return s.category;
    case "stock":
      // Out of stock first, then low, then by quantity.
      return STATE_ORDER[s.state] * 10_000_000 + s.quantity;
    case "value":
      return s.value;
    case "storage":
      return s.storage || null;
    default:
      return null;
  }
}

export type SpareFilters = { stock: "low" | "out" | null; category: string | null };

export function parseSpareFilters(query: Record<string, string | string[] | undefined>, categories: Set<string>): SpareFilters {
  const st = query.stock;
  const c = query.category;
  return {
    stock: st === "low" || st === "out" ? st : null,
    category: typeof c === "string" && categories.has(c) ? c : null,
  };
}

/** "Low" includes out of stock: both need ordering. */
export function applySpareFilters(rows: readonly SpareRow[], f: SpareFilters): SpareRow[] {
  return rows.filter(
    (s) =>
      (!f.category || s.categoryId === f.category) &&
      (!f.stock || (f.stock === "out" ? s.state === "out" : s.state !== "ok")),
  );
}
