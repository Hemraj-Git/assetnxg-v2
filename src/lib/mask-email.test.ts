import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it.each([
    ["anita.rao@seaward.example", "an•••.rao@seaward.example"],
    ["kavita@soms.edu", "ka•••@soms.edu"],
    ["ab@x.io", "a•••@x.io"],
    ["a@x.io", "a•••@x.io"],
    ["not-an-email", "•••"],
  ])("%s → %s", (input, out) => {
    expect(maskEmail(input)).toBe(out);
  });
});
