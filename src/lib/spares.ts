import type { Database } from "@/lib/supabase/database.types";

// Spares and stock (03 §10). The database keeps the quantity and refuses
// stock below zero; these helpers explain it on screen.

export type StockReason = Database["public"]["Enums"]["stock_reason"];
export type StockState = "out" | "low" | "ok";

/** Low stock when no minimum is set (03 §10). */
export const DEFAULT_MIN_STOCK = 2;

export const STOCK_STATE_LABEL: Record<StockState, string> = {
  out: "Out of stock",
  low: "Low stock",
  ok: "In stock",
};

export const STOCK_REASON_LABEL: Record<StockReason, string> = {
  opening: "Opening stock",
  received: "Received",
  issued: "Taken out",
  adjusted: "Count corrected",
  deployed: "Deployed as asset",
};

/** 0 = out of stock; at or below the minimum (2 when unset) = low. */
export function stockState(quantity: number, minStock: number | null): StockState {
  if (quantity <= 0) return "out";
  if (quantity <= (minStock ?? DEFAULT_MIN_STOCK)) return "low";
  return "ok";
}

/** Quantity × unit cost, or null when the cost isn't recorded. */
export function stockValue(quantity: number, unitCost: number | null): number | null {
  return unitCost === null ? null : Math.round(quantity * unitCost * 100) / 100;
}

/** "+3", "−2" (a real minus sign), "0". */
export function formatChange(change: number): string {
  if (change > 0) return `+${change.toLocaleString("en-IN")}`;
  if (change < 0) return `−${Math.abs(change).toLocaleString("en-IN")}`;
  return "0";
}

/** The stock form: what the person means → the movement to record. */
export type StockAction = "received" | "issued" | "adjusted";

export function parseStockInput(
  action: string,
  quantityText: string,
): { reason: StockAction; change: number; counted: number | null } | { error: string } {
  if (action !== "received" && action !== "issued" && action !== "adjusted") return { error: "Choose what happened." };
  const raw = quantityText.trim().replace(/,/g, "");
  if (!/^\d+$/.test(raw)) {
    return { error: action === "adjusted" ? "Enter the quantity you counted, as a whole number." : "Enter how many, as a whole number." };
  }
  const n = Number(raw);
  if (n > 1_000_000) return { error: "That is more than the stock can hold (1,000,000)." };
  if (action === "adjusted") return { reason: "adjusted", change: 0, counted: n };
  if (n === 0) return { error: "Enter how many (more than 0)." };
  return { reason: action, change: action === "received" ? n : -n, counted: null };
}
