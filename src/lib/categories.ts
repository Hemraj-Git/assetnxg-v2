import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

// Categories, sub-categories and the extra asset fields a sub-category asks
// for (02 "Taxonomy"). The database checks the same field rules
// (private.valid_asset_fields); these explain them on screen first.

export type SlaPriority = Database["public"]["Enums"]["sla_priority"];

/** Most urgent first (03 §5). */
export const SLA_PRIORITIES: readonly SlaPriority[] = ["critical", "high", "medium", "low"];

export const PRIORITY_LABEL: Record<SlaPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export type AssetFieldType = "text" | "number" | "date";

export const FIELD_TYPE_LABEL: Record<AssetFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
};

export type AssetField = {
  /** Stable id: assets store their values under it, so renaming a label
   *  keeps the values. */
  key: string;
  label: string;
  type: AssetFieldType;
  unit: string | null;
  required: boolean;
};

export const MAX_ASSET_FIELDS = 30;

const fieldSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  label: z.string().trim().min(1, "Give every field a name.").max(60, "Keep field names under 60 characters."),
  type: z.enum(["text", "number", "date"]),
  unit: z
    .string()
    .trim()
    .max(20, "Keep units under 20 characters.")
    .nullable()
    .transform((u) => (u ? u : null)),
  required: z.boolean(),
});

/** Reads the field list a form sends (JSON). Plain-words error, or the
 *  clean list in the order given. */
export function parseAssetFields(raw: unknown): { ok: true; fields: AssetField[] } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
  } catch {
    return { ok: false, error: "The field list couldn't be read. Refresh the page and try again." };
  }
  const parsed = z.array(fieldSchema).safeParse(data);
  if (!parsed.success) {
    const message = parsed.error.issues.find((i) => i.path.at(-1) !== "key" && i.message)?.message;
    return { ok: false, error: message && !message.startsWith("Invalid") ? message : "Check the asset fields." };
  }
  const fields = parsed.data;
  if (fields.length > MAX_ASSET_FIELDS) return { ok: false, error: `Up to ${MAX_ASSET_FIELDS} fields.` };
  if (new Set(fields.map((f) => f.key)).size !== fields.length) {
    return { ok: false, error: "Check the asset fields." };
  }
  const labels = fields.map((f) => f.label.toLowerCase());
  const dup = labels.find((l, i) => labels.indexOf(l) !== i);
  if (dup !== undefined) {
    const name = fields.find((f) => f.label.toLowerCase() === dup)?.label;
    return { ok: false, error: `Two fields are called “${name}”. Give each field its own name.` };
  }
  return { ok: true, fields };
}

/** A new field's key: short and random, so it never clashes or changes. */
export function newFieldKey(random: () => string = () => crypto.randomUUID()): string {
  return `f_${random().replace(/-/g, "").slice(0, 10)}`;
}

/** Reads a stored list leniently for display (bad entries dropped). */
export function storedAssetFields(raw: unknown): AssetField[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = fieldSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export type CategoryNode = { id: string; code: string; name: string; description: string | null };
export type SubCategoryNode = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  description: string | null;
  slaPriority: SlaPriority | null;
  assetFields: AssetField[];
};

export type TaxonomyRow =
  | { kind: "category"; category: CategoryNode; subCount: number }
  | { kind: "sub"; sub: SubCategoryNode; category: CategoryNode };

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true });

/** Categories by name, each followed by its sub-categories by name. */
export function taxonomyTree(categories: readonly CategoryNode[], subs: readonly SubCategoryNode[]): TaxonomyRow[] {
  const out: TaxonomyRow[] = [];
  for (const category of [...categories].sort(byName)) {
    const mine = subs.filter((s) => s.categoryId === category.id).sort(byName);
    out.push({ kind: "category", category, subCount: mine.length });
    for (const sub of mine) out.push({ kind: "sub", sub, category });
  }
  return out;
}
