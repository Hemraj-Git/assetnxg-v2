import { describe, expect, it } from "vitest";
import { formatChange, parseStockInput, stockState, stockValue } from "./spares";

describe("stockState", () => {
  it("0 is out of stock", () => {
    expect(stockState(0, 5)).toBe("out");
  });
  it("at or below the minimum is low", () => {
    expect(stockState(5, 5)).toBe("low");
    expect(stockState(6, 5)).toBe("ok");
  });
  it("uses 2 when no minimum is set", () => {
    expect(stockState(2, null)).toBe("low");
    expect(stockState(3, null)).toBe("ok");
  });
  it("a minimum of 0 means only 0 is a problem", () => {
    expect(stockState(1, 0)).toBe("ok");
  });
});

describe("stockValue / formatChange", () => {
  it("multiplies, or nothing without a cost", () => {
    expect(stockValue(3, 41000.5)).toBe(123001.5);
    expect(stockValue(3, null)).toBeNull();
  });
  it("shows signed changes", () => {
    expect(formatChange(1500)).toBe("+1,500");
    expect(formatChange(-2)).toBe("−2");
    expect(formatChange(0)).toBe("0");
  });
});

describe("parseStockInput", () => {
  it("received adds, taken out subtracts", () => {
    expect(parseStockInput("received", "3")).toEqual({ reason: "received", change: 3, counted: null });
    expect(parseStockInput("issued", "1,000")).toEqual({ reason: "issued", change: -1000, counted: null });
  });
  it("a count is sent as counted (0 allowed)", () => {
    expect(parseStockInput("adjusted", "0")).toEqual({ reason: "adjusted", change: 0, counted: 0 });
  });
  it("gives plain reasons", () => {
    expect(parseStockInput("received", "0")).toEqual({ error: "Enter how many (more than 0)." });
    expect(parseStockInput("issued", "2.5")).toEqual({ error: "Enter how many, as a whole number." });
    expect(parseStockInput("adjusted", "")).toEqual({ error: "Enter the quantity you counted, as a whole number." });
    expect(parseStockInput("deployed", "1")).toEqual({ error: "Choose what happened." });
    expect(parseStockInput("received", "2000000")).toEqual({ error: "That is more than the stock can hold (1,000,000)." });
  });
});
