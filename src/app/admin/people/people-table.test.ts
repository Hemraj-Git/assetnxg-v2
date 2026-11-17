import { describe, expect, it } from "vitest";
import { applyTableParams, parseTableParams } from "@/lib/table-params";
import { PEOPLE_TABLE, mergeRoles, personSearchText, personSortValue, type PersonRow } from "./people-table";

const base: PersonRow = {
  membershipId: "m1",
  userId: "u1",
  name: "Ravi Kumar",
  email: "ravi@example.com",
  phone: null,
  roles: ["technician"],
  departmentId: null,
  departmentPath: null,
  heads: [],
  pending: false,
  addedAt: "2026-11-01T05:00:00Z",
  firstSignedInAt: "2026-11-02T05:00:00Z",
  isMe: false,
};

const people: PersonRow[] = [
  base,
  { ...base, membershipId: "m2", name: "Anita Rao", email: "anita@example.com", roles: ["admin"], departmentPath: "Academics", pending: true },
  { ...base, membershipId: "m3", name: "sunita Das", email: "sunita@example.com", roles: ["accounts"], departmentPath: "Accounts" },
];

const run = (q: Record<string, string>) =>
  applyTableParams(people, parseTableParams(q, PEOPLE_TABLE), { searchText: personSearchText, sortValue: personSortValue })
    .rows.map((p) => p.membershipId);

describe("people list", () => {
  it("sorts by name by default, ignoring case", () => {
    expect(run({})).toEqual(["m2", "m1", "m3"]);
  });

  it("searches name, email, role words and department", () => {
    expect(run({ q: "ANITA" })).toEqual(["m2"]);
    expect(run({ q: "technician" })).toEqual(["m1"]);
    expect(run({ q: "accounts" })).toEqual(["m3"]);
  });

  it("puts people without a department last when sorting by department", () => {
    expect(run({ sort: "department", dir: "desc" })).toEqual(["m3", "m2", "m1"]);
    expect(run({ sort: "department", dir: "asc" })).toEqual(["m2", "m3", "m1"]);
  });

  it("sorts by status words", () => {
    expect(run({ sort: "status" })[0]).not.toBe("m2");
    expect(run({ sort: "status", dir: "desc" })[0]).toBe("m2");
  });
});

describe("mergeRoles", () => {
  it("keeps roles the form didn't offer", () => {
    expect(mergeRoles(["technician"], ["admin", "accounts"], ["admin", "technician", "housekeeping", "faculty"])).toEqual([
      "technician",
      "accounts",
    ]);
  });

  it("removes offered roles that were unticked", () => {
    expect(mergeRoles([], ["admin"], ["admin"])).toEqual([]);
  });
});
