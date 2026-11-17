// Amounts on screen: Indian digit grouping, two decimals (12,40,000.00).
// The currency symbol goes in the column header ("Purchase cost (₹)"), not in
// every cell; the currency is an organisation setting (₹ by default).

const amount = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return amount.format(value);
}

const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED" };

/** "₹" for INR; the code itself for currencies without a short symbol. */
export function currencySymbol(code: string = "INR"): string {
  return SYMBOLS[code.toUpperCase()] ?? code.toUpperCase();
}
