import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/work-orders?status=open", "/admin/work-orders?status=open"],
    ["  /admin  ", "/admin"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["/admin\\..\\x"],
    ["javascript:alert(1)"],
    ["admin"],
    ["/admin\n"],
    ["/sign-in"],
    ["/sign-in?next=/admin"],
    [""],
    [null],
    [undefined],
    [42],
  ])("falls back for %s", (input) => {
    expect(safeNextPath(input)).toBe("/admin");
  });
});
