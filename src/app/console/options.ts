// Choices offered when setting up a client. The database accepts any valid
// IANA time zone, 3-letter currency and xx-YY locale; these are the common ones.

export const TIME_ZONES = [
  { value: "Asia/Kolkata", label: "India (Asia/Kolkata, UTC+05:30)" },
  { value: "Asia/Dubai", label: "UAE (Asia/Dubai, UTC+04:00)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+08:00)" },
  { value: "Asia/Dhaka", label: "Bangladesh (Asia/Dhaka, UTC+06:00)" },
  { value: "Asia/Colombo", label: "Sri Lanka (Asia/Colombo, UTC+05:30)" },
  { value: "Europe/London", label: "United Kingdom (Europe/London)" },
  { value: "UTC", label: "UTC" },
] as const;

export const CURRENCIES = [
  { value: "INR", label: "₹ Indian rupee (INR)" },
  { value: "AED", label: "AED UAE dirham" },
  { value: "SGD", label: "S$ Singapore dollar (SGD)" },
  { value: "USD", label: "$ US dollar (USD)" },
  { value: "EUR", label: "€ Euro (EUR)" },
  { value: "GBP", label: "£ Pound sterling (GBP)" },
] as const;

export const LOCALES = [
  { value: "en-IN", label: "English (India) · DD-MM-YYYY, 1,23,456" },
  { value: "en-GB", label: "English (UK) · DD-MM-YYYY, 123,456" },
  { value: "en-US", label: "English (US)" },
] as const;
