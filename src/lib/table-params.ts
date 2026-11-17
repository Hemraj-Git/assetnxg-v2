// Table state in the URL (canvas · Data table: "State lives in the URL so
// links and the Back button work"). The same parser runs on the server page
// (which fetches only the rows it needs) and in the table (which writes it
// back). Defaults are left out of the URL to keep links short.
//
//   ?q=split+ac&sort=name&dir=desc&page=2&size=50

export type SortDir = "asc" | "desc";

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export type TableParams = {
  q: string;
  sort: string | null;
  dir: SortDir;
  page: number;
  size: PageSize;
};

export type TableDefaults = {
  /** Column ids that may be sorted; anything else in the URL is ignored. */
  sortable: readonly string[];
  sort?: string | null;
  dir?: SortDir;
  size?: PageSize;
};

type SearchInput = URLSearchParams | Record<string, string | string[] | undefined>;

function read(input: SearchInput, key: string): string | undefined {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
  const v = input[key];
  return Array.isArray(v) ? v[0] : v;
}

const MAX_QUERY = 100;

export function parseTableParams(input: SearchInput, defaults: TableDefaults): TableParams {
  const q = (read(input, "q") ?? "").trim().slice(0, MAX_QUERY);

  const rawSort = read(input, "sort");
  const sortOk = rawSort !== undefined && defaults.sortable.includes(rawSort);
  // "sort=none" means the person turned sorting off.
  const sort = rawSort === "none" ? null : sortOk ? rawSort : (defaults.sort ?? null);

  const rawDir = read(input, "dir");
  const dir: SortDir =
    rawDir === "asc" || rawDir === "desc" ? rawDir : (defaults.dir ?? "asc");

  const rawSize = Number(read(input, "size"));
  const size = (PAGE_SIZES as readonly number[]).includes(rawSize)
    ? (rawSize as PageSize)
    : (defaults.size ?? 25);

  const rawPage = Number(read(input, "page"));
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 100_000 ? rawPage : 1;

  return { q, sort, dir, page, size };
}

/**
 * The search string after a change. Changing the search, sort or page size
 * goes back to page 1. Values equal to the defaults are dropped; other
 * parameters already in the URL (filters, ?open=) are kept.
 */
export function withTableParams(
  current: URLSearchParams,
  change: Partial<TableParams>,
  defaults: TableDefaults,
): URLSearchParams {
  const before = parseTableParams(current, defaults);
  const next: TableParams = { ...before, ...change };
  if (change.q !== undefined || change.sort !== undefined || change.dir !== undefined || change.size !== undefined) {
    if (change.page === undefined) next.page = 1;
  }

  const out = new URLSearchParams(current);
  const set = (key: string, value: string | null) => {
    if (value === null) out.delete(key);
    else out.set(key, value);
  };

  set("q", next.q ? next.q : null);
  const defaultSort = defaults.sort ?? null;
  const defaultDir = defaults.dir ?? "asc";
  if (next.sort === defaultSort) {
    set("sort", null);
    set("dir", next.sort && next.dir !== defaultDir ? next.dir : null);
  } else {
    set("sort", next.sort ?? "none");
    set("dir", next.sort && next.dir !== "asc" ? next.dir : null);
  }
  set("page", next.page > 1 ? String(next.page) : null);
  set("size", next.size !== (defaults.size ?? 25) ? String(next.size) : null);
  return out;
}

/** Header click: ascending → descending → off (canvas keyboard rules). */
export function nextSort(
  current: { sort: string | null; dir: SortDir },
  column: string,
): { sort: string | null; dir: SortDir } {
  if (current.sort !== column) return { sort: column, dir: "asc" };
  if (current.dir === "asc") return { sort: column, dir: "desc" };
  return { sort: null, dir: "asc" };
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/** Pager buttons: 1 2 3 … 13, always the first, last and the current ±1. */
export function pageWindow(page: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const keep = new Set([1, count, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => keep.add(p));
  if (page >= count - 2) [count - 3, count - 2, count - 1].forEach((p) => keep.add(p));
  const pages = [...keep].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (const p of pages) {
    const last = out[out.length - 1];
    if (typeof last === "number" && p - last > 1) out.push("gap");
    out.push(p);
  }
  return out;
}

const count = new Intl.NumberFormat("en-IN");

/** Indian digit grouping for counts: 1,284 · 1,23,456. */
export function formatCount(n: number): string {
  return count.format(n);
}

/** Footer text: "1–25 of 312", "0 of 0". */
export function rangeLabel(page: number, size: number, total: number): string {
  if (total === 0) return "0 of 0";
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return `${formatCount(from)}–${formatCount(to)} of ${formatCount(total)}`;
}

/**
 * For small lists held in memory (and the patterns preview): search, sort
 * and page an array the way a server page would with a database query.
 */
export function applyTableParams<T>(
  rows: readonly T[],
  params: TableParams,
  options: {
    searchText: (row: T) => string;
    sortValue: (row: T, column: string) => string | number | null;
  },
): { rows: T[]; total: number; page: number } {
  const needle = params.q.toLowerCase();
  let list = needle ? rows.filter((r) => options.searchText(r).toLowerCase().includes(needle)) : [...rows];

  if (params.sort) {
    const column = params.sort;
    const sign = params.dir === "asc" ? 1 : -1;
    const text = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
    list = list.sort((a, b) => {
      const va = options.sortValue(a, column);
      const vb = options.sortValue(b, column);
      // Empty values always last, whichever the direction.
      if (va === null || va === "") return vb === null || vb === "" ? 0 : 1;
      if (vb === null || vb === "") return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sign;
      return text.compare(String(va), String(vb)) * sign;
    });
  }

  const total = list.length;
  const page = Math.min(params.page, pageCount(total, params.size));
  const start = (page - 1) * params.size;
  return { rows: list.slice(start, start + params.size), total, page };
}
