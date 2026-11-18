import { describe, expect, it } from "vitest";
import { isId, optionalId, optionalNumber, text } from "./form-actions";

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const ID = "7b2f3c1e-8a4d-4e5f-9a1b-2c3d4e5f6a7b";

describe("form readers", () => {
  it("trims text and treats missing as empty", () => {
    expect(text(form({ a: "  hi " }), "a")).toBe("hi");
    expect(text(form({}), "a")).toBe("");
  });

  it("reads a picker: empty is nothing chosen, junk is refused", () => {
    expect(optionalId(form({ p: "" }), "p")).toBeNull();
    expect(optionalId(form({ p: ID }), "p")).toBe(ID);
    expect(optionalId(form({ p: "not-an-id" }), "p")).toBeUndefined();
    expect(isId(ID)).toBe(true);
  });

  it("reads numbers with Indian grouping commas", () => {
    expect(optionalNumber(form({ n: "1,25,000" }), "n")).toBe(125000);
    expect(optionalNumber(form({ n: "650.5" }), "n")).toBe(650.5);
    expect(optionalNumber(form({ n: "" }), "n")).toBeNull();
    expect(optionalNumber(form({ n: "-3" }), "n")).toBeUndefined();
    expect(optionalNumber(form({ n: "12abc" }), "n")).toBeUndefined();
  });
});
