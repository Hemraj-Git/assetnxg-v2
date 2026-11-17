import { describe, expect, it } from "vitest";
import {
  applyTableParams,
  formatCount,
  nextSort,
  pageWindow,
  parseTableParams,
  rangeLabel,
  withTableParams,
  type TableDefaults,
} from "./table-params";

const defaults: TableDefaults = { sortable: ["id", "name", "cost"], sort: "id", dir: "asc" };

describe("parseTableParams", () => {
  it("uses the defaults for an empty URL", () => {
    expect(parseTableParams({}, defaults)).toEqual({ q: "", sort: "id", dir: "asc", page: 1, size: 25 });
  });

  it("reads valid values", () => {
    const p = parseTableParams(new URLSearchParams("q=+split ac &sort=name&dir=desc&page=3&size=50"), defaults);
    expect(p).toEqual({ q: "split ac", sort: "name", dir: "desc", page: 3, size: 50 });
  });

  it("ignores columns that can't be sorted, odd sizes and bad pages", () => {
    const p = parseTableParams({ sort: "secret", size: "1000", page: "-2", dir: "sideways" }, defaults);
    expect(p).toEqual({ q: "", sort: "id", dir: "asc", page: 1, size: 25 });
  });

  it("sort=none turns sorting off", () => {
    expect(parseTableParams({ sort: "none" }, defaults).sort).toBeNull();
  });

  it("caps a very long search", () => {
    expect(parseTableParams({ q: "x".repeat(500) }, defaults).q).toHaveLength(100);
  });
});

describe("withTableParams", () => {
  it("drops defaults and keeps other parameters", () => {
    const out = withTableParams(new URLSearchParams("open=abc&page=4"), { page: 1 }, defaults);
    expect(out.toString()).toBe("open=abc");
  });

  it("goes back to page 1 when the search, sort or size changes", () => {
    const base = new URLSearchParams("page=4");
    expect(withTableParams(base, { q: "ac" }, defaults).toString()).toBe("q=ac");
    expect(withTableParams(base, { sort: "name", dir: "desc" }, defaults).toString()).toBe("sort=name&dir=desc");
    expect(withTableParams(base, { size: 100 }, defaults).toString()).toBe("size=100");
  });

  it("writes sort=none when sorting is turned off and the default sorts", () => {
    expect(withTableParams(new URLSearchParams(), { sort: null }, defaults).toString()).toBe("sort=none");
  });

  it("keeps a descending default column as dir only", () => {
    expect(withTableParams(new URLSearchParams(), { sort: "id", dir: "desc" }, defaults).toString()).toBe("dir=desc");
  });

  it("round-trips", () => {
    const out = withTableParams(new URLSearchParams(), { q: "pump", sort: "cost", dir: "desc", size: 50 }, defaults);
    expect(parseTableParams(out, defaults)).toEqual({ q: "pump", sort: "cost", dir: "desc", page: 1, size: 50 });
  });
});

describe("nextSort", () => {
  it("cycles ascending, descending, off", () => {
    let s = nextSort({ sort: null, dir: "asc" }, "name");
    expect(s).toEqual({ sort: "name", dir: "asc" });
    s = nextSort(s, "name");
    expect(s).toEqual({ sort: "name", dir: "desc" });
    expect(nextSort(s, "name")).toEqual({ sort: null, dir: "asc" });
  });

  it("a new column starts ascending", () => {
    expect(nextSort({ sort: "id", dir: "desc" }, "cost")).toEqual({ sort: "cost", dir: "asc" });
  });
});

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("matches the canvas at the start: 1 2 3 4 … 13", () => {
    expect(pageWindow(1, 13)).toEqual([1, 2, 3, 4, "gap", 13]);
  });

  it("shows the neighbours in the middle", () => {
    expect(pageWindow(7, 13)).toEqual([1, "gap", 6, 7, 8, "gap", 13]);
  });

  it("and at the end", () => {
    expect(pageWindow(13, 13)).toEqual([1, "gap", 10, 11, 12, 13]);
  });
});

describe("counts and range", () => {
  it("uses Indian digit grouping", () => {
    expect(formatCount(1284)).toBe("1,284");
    expect(formatCount(123456)).toBe("1,23,456");
  });

  it("labels the rows shown", () => {
    expect(rangeLabel(1, 25, 312)).toBe("1–25 of 312");
    expect(rangeLabel(13, 25, 312)).toBe("301–312 of 312");
    expect(rangeLabel(1, 25, 0)).toBe("0 of 0");
  });
});

describe("applyTableParams", () => {
  type Row = { id: string; name: string; cost: number | null };
  const rows: Row[] = [
    { id: "AST-0010", name: "Split AC 2 Ton", cost: 48500 },
    { id: "AST-0002", name: "DG set", cost: 1240000 },
    { id: "AST-0101", name: "Split AC 1.5 Ton", cost: null },
  ];
  const opts = {
    searchText: (r: Row) => `${r.id} ${r.name}`,
    sortValue: (r: Row, c: string) => (c === "cost" ? r.cost : c === "name" ? r.name : r.id),
  };
  const params = parseTableParams({}, defaults);

  it("sorts IDs in number order", () => {
    expect(applyTableParams(rows, params, opts).rows.map((r) => r.id)).toEqual(["AST-0002", "AST-0010", "AST-0101"]);
  });

  it("searches case-insensitively", () => {
    const out = applyTableParams(rows, { ...params, q: "split ac" }, opts);
    expect(out.total).toBe(2);
  });

  it("keeps empty values last in both directions", () => {
    const asc = applyTableParams(rows, { ...params, sort: "cost", dir: "asc" }, opts).rows.map((r) => r.id);
    const desc = applyTableParams(rows, { ...params, sort: "cost", dir: "desc" }, opts).rows.map((r) => r.id);
    expect(asc).toEqual(["AST-0010", "AST-0002", "AST-0101"]);
    expect(desc).toEqual(["AST-0002", "AST-0010", "AST-0101"]);
  });

  it("pulls a page past the end back to the last page", () => {
    const out = applyTableParams(rows, { ...params, page: 9 }, opts);
    expect(out.page).toBe(1);
    expect(out.rows).toHaveLength(3);
  });
});
