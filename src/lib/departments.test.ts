import { describe, expect, it } from "vitest";
import { departmentTree, parentChoices, selfAndDescendants } from "./departments";

const rows = [
  { id: "w", name: "Workshop", parentId: "m" },
  { id: "a", name: "Academics", parentId: null },
  { id: "m", name: "Marine Engineering", parentId: "a" },
  { id: "n", name: "Nautical Science", parentId: "a" },
  { id: "f", name: "finance", parentId: null },
];

describe("departmentTree", () => {
  it("orders depth-first with siblings by name, ignoring case", () => {
    expect(departmentTree(rows).map((r) => [r.id, r.depth])).toEqual([
      ["a", 0],
      ["m", 1],
      ["w", 2],
      ["n", 1],
      ["f", 0],
    ]);
  });

  it("labels each with its path", () => {
    expect(departmentTree(rows).find((r) => r.id === "w")?.path).toBe("Academics › Marine Engineering › Workshop");
  });

  it("puts a department with a missing parent at the top level", () => {
    expect(departmentTree([{ id: "x", name: "Orphan", parentId: "gone" }])).toEqual([
      { id: "x", name: "Orphan", parentId: "gone", depth: 0, path: "Orphan" },
    ]);
  });

  it("never loops on bad data", () => {
    const loop = [
      { id: "p", name: "P", parentId: "q" },
      { id: "q", name: "Q", parentId: "p" },
    ];
    expect(departmentTree(loop)).toEqual([]);
  });
});

describe("selfAndDescendants / parentChoices", () => {
  it("finds a department and everything under it", () => {
    expect([...selfAndDescendants(rows, "a")].sort()).toEqual(["a", "m", "n", "w"]);
  });

  it("offers every department except itself and its own sub-departments", () => {
    expect(parentChoices(rows, "m").map((r) => r.id)).toEqual(["a", "n", "f"]);
    expect(parentChoices(rows, null)).toHaveLength(5);
  });
});
