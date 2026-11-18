import { z } from "zod";
import type { AppModule } from "@/lib/modules";
import type { Database } from "@/lib/supabase/database.types";

// Checklist templates for PM jobs and inspections (02 "Checklist
// templates"). The database checks the same item rules
// (private.valid_checklist_items); these explain them on screen first.

export type ChecklistKind = Database["public"]["Enums"]["checklist_kind"];
export type RepeatInterval = Database["public"]["Enums"]["repeat_interval"];

export const KIND_LABEL: Record<ChecklistKind, string> = { pm: "PM", inspection: "Inspection" };
export const KIND_MODULE: Record<ChecklistKind, AppModule> = { pm: "maintenance", inspection: "inspections" };

export const REPEATS: readonly RepeatInterval[] = ["weekly", "monthly", "quarterly", "half_yearly", "annually"];
export const REPEAT_LABEL: Record<RepeatInterval, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  annually: "Annually",
};

export type ResponseType = "checkbox" | "pass_fail" | "yes_no" | "numeric" | "text";
export const RESPONSES: readonly ResponseType[] = ["checkbox", "pass_fail", "yes_no", "numeric", "text"];
export const RESPONSE_LABEL: Record<ResponseType, string> = {
  checkbox: "Done / not done",
  pass_fail: "Pass / fail",
  yes_no: "Yes / no",
  numeric: "Number",
  text: "Text",
};

export type ChecklistItem = {
  /** Stable id: answers are stored under it. */
  key: string;
  text: string;
  instructions: string | null;
  response: ResponseType;
  /** Only for numbers, e.g. "°C". */
  unit: string | null;
  mandatory: boolean;
  photo_required: boolean;
};

export const MAX_ITEMS = 100;

const blankToNull = (v: string | null) => (v ? v : null);

const itemSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  text: z.string().trim().min(1, "Give every item its wording.").max(200, "Keep each item under 200 characters."),
  instructions: z.string().trim().max(500, "Keep instructions under 500 characters.").nullable().transform(blankToNull),
  response: z.enum(["checkbox", "pass_fail", "yes_no", "numeric", "text"]),
  unit: z.string().trim().max(20, "Keep units under 20 characters.").nullable().transform(blankToNull),
  mandatory: z.boolean(),
  photo_required: z.boolean(),
});

/** Reads the item list a form sends (JSON): plain-words error, or the clean
 *  list in the order given (units kept only for numbers). */
export function parseChecklistItems(raw: unknown): { ok: true; items: ChecklistItem[] } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
  } catch {
    return { ok: false, error: "The checklist couldn't be read. Refresh the page and try again." };
  }
  const parsed = z.array(itemSchema).safeParse(data);
  if (!parsed.success) {
    const message = parsed.error.issues.find((i) => i.path.at(-1) !== "key" && i.message)?.message;
    return { ok: false, error: message && !message.startsWith("Invalid") ? message : "Check the checklist items." };
  }
  const items = parsed.data.map((i) => ({ ...i, unit: i.response === "numeric" ? i.unit : null }));
  if (items.length === 0) return { ok: false, error: "Add at least one checklist item." };
  if (items.length > MAX_ITEMS) return { ok: false, error: `Up to ${MAX_ITEMS} items.` };
  if (new Set(items.map((i) => i.key)).size !== items.length) return { ok: false, error: "Check the checklist items." };
  return { ok: true, items };
}

/** A stored list read leniently for display (bad entries dropped). */
export function storedItems(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = itemSchema.safeParse({ instructions: null, unit: null, ...item });
    return parsed.success ? [parsed.data] : [];
  });
}

export function newItemKey(random: () => string = () => crypto.randomUUID()): string {
  return `i_${random().replace(/-/g, "").slice(0, 10)}`;
}

/** "Number · °C", "Pass / fail": how an item is answered. */
export function answerLabel(item: Pick<ChecklistItem, "response" | "unit">): string {
  return item.response === "numeric" && item.unit ? `${RESPONSE_LABEL.numeric} · ${item.unit}` : RESPONSE_LABEL[item.response];
}

/** The kinds this client can use (from its modules). */
export function kindsFor(modules: readonly AppModule[]): ChecklistKind[] {
  return (["pm", "inspection"] as const).filter((k) => modules.includes(KIND_MODULE[k]));
}
