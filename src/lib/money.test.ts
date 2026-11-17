import { describe, expect, it } from "vitest";
import { currencySymbol, formatAmount } from "./money";

describe("formatAmount", () => {
  it("groups the Indian way with two decimals", () => {
    expect(formatAmount(48500)).toBe("48,500.00");
    expect(formatAmount(1240000)).toBe("12,40,000.00");
    expect(formatAmount(18500000.5)).toBe("1,85,00,000.50");
  });

  it("is empty for missing values", () => {
    expect(formatAmount(null)).toBe("");
    expect(formatAmount(Number.NaN)).toBe("");
  });
});

describe("currencySymbol", () => {
  it("knows ₹ and falls back to the code", () => {
    expect(currencySymbol()).toBe("₹");
    expect(currencySymbol("sgd")).toBe("SGD");
  });
});
