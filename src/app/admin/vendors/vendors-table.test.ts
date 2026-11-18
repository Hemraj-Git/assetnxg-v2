import { describe, expect, it } from "vitest";
import { applyTableParams, parseTableParams } from "@/lib/table-params";
import { VENDORS_TABLE, vendorSearchText, vendorSortValue, type VendorRow } from "./vendors-table";

const base: VendorRow = {
  id: "v1",
  code: "VND-0001",
  name: "Cool Air Services",
  categoryIds: ["h"],
  supplies: ["HVAC"],
  contactPerson: "Ravi",
  phone: "+91 98765 43210",
  email: "sales@coolair.in",
  address: null,
  contracts: [],
};

const vendors: VendorRow[] = [
  base,
  { ...base, id: "v2", code: "VND-0002", name: "bright Electricals", supplies: ["Electrical"], contactPerson: null },
  { ...base, id: "v3", code: "VND-0003", name: "Aqua Plumbers", supplies: ["Plumbing"], contactPerson: "Asha" },
  { ...base, id: "v4", code: "VND-0004", name: "Delta Lifts", supplies: [], contactPerson: "Zubin" },
];

const run = (q: Record<string, string>) =>
  applyTableParams(vendors, parseTableParams(q, VENDORS_TABLE), { searchText: vendorSearchText, sortValue: vendorSortValue })
    .rows.map((v) => v.id);

describe("vendors list", () => {
  it("sorts by name by default, ignoring case", () => {
    expect(run({})).toEqual(["v3", "v2", "v1", "v4"]);
  });

  it("searches name, number, what they supply and contact", () => {
    expect(run({ q: "electrical" })).toEqual(["v2"]);
    expect(run({ q: "vnd-0004" })).toEqual(["v4"]);
    expect(run({ q: "asha" })).toEqual(["v3"]);
  });

  it("puts vendors with nothing in the sorted column last", () => {
    expect(run({ sort: "supplies" }).at(-1)).toBe("v4");
    expect(run({ sort: "contact", dir: "desc" }).at(-1)).toBe("v2");
  });
});
