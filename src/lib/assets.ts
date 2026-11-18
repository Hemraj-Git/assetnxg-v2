import type { AssetField } from "@/lib/categories";
import { formatDate, parseDisplayDate } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

// Assets (02 "Assets"; 03 §2). Pure helpers for screens and forms; the
// database checks the same rules again.

export type AssetStatus = Database["public"]["Enums"]["asset_status"];

export const ASSET_STATUSES: readonly AssetStatus[] = ["operational", "under_maintenance", "in_storage", "retired"];

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  operational: "Operational",
  under_maintenance: "Under maintenance",
  in_storage: "In storage",
  retired: "Retired",
};

/** "2 y 7 m", "5 m", "Under a month" from an ISO date to today (ISO). */
export function assetAge(sinceIso: string | null, todayIso: string): string {
  if (!sinceIso) return "";
  const [y1, m1, d1] = sinceIso.split("-").map(Number);
  const [y2, m2, d2] = todayIso.split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (months < 0) return "";
  if (months === 0) return "Under a month";
  const years = Math.floor(months / 12);
  months %= 12;
  if (years === 0) return `${months} m`;
  return months === 0 ? `${years} y` : `${years} y ${months} m`;
}

export type SpecValue = string | number;

/**
 * Reads the specification inputs a form sends (`spec:<key>` = text as typed)
 * into stored values: numbers as numbers (Indian grouping commas allowed),
 * dates DD-MM-YYYY → ISO, text trimmed. Empty = not set. Returns the first
 * problem in plain words, or the values.
 */
export function parseSpecInputs(
  fields: readonly AssetField[],
  read: (key: string) => string,
): { ok: true; values: Record<string, SpecValue> } | { ok: false; error: string } {
  const values: Record<string, SpecValue> = {};
  for (const f of fields) {
    const raw = read(f.key).trim();
    if (!raw) {
      if (f.required) return { ok: false, error: `Fill in “${f.label}”.` };
      continue;
    }
    if (f.type === "number") {
      const clean = raw.replace(/,/g, "");
      if (!/^-?\d+(\.\d+)?$/.test(clean)) return { ok: false, error: `“${f.label}” must be a number.` };
      values[f.key] = Number(clean);
    } else if (f.type === "date") {
      const iso = parseDisplayDate(raw);
      if (!iso) return { ok: false, error: `Enter “${f.label}” as DD-MM-YYYY.` };
      values[f.key] = iso;
    } else {
      if (raw.length > 200) return { ok: false, error: `Keep “${f.label}” under 200 characters.` };
      values[f.key] = raw;
    }
  }
  return { ok: true, values };
}

/** A stored value as typed in a form: dates back to DD-MM-YYYY. */
export function specInputValue(field: AssetField, stored: unknown): string {
  if (stored === null || stored === undefined) return "";
  if (field.type === "date" && typeof stored === "string") return formatDate(stored);
  return String(stored);
}

/** A stored value for reading: "1.5 ton", "12-03-2024", "R32"; "" if unset. */
export function specDisplay(field: AssetField, stored: unknown): string {
  if (stored === null || stored === undefined || stored === "") return "";
  if (field.type === "date" && typeof stored === "string") return formatDate(stored);
  if (field.type === "number" && typeof stored === "number") {
    const n = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 }).format(stored);
    return field.unit ? `${n} ${field.unit}` : n;
  }
  return String(stored);
}
