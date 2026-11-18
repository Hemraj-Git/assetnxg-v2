import { z } from "zod";

// Shared shapes for Server Actions that take a form: the result type the
// forms show, and readers for form fields. Plain words only (CLAUDE.md).

export type ActionState = { error: string | null; success: string | null };

export const initialActionState: ActionState = { error: null, success: null };

export const ok = (success: string): ActionState => ({ error: null, success });
export const fail = (error: string): ActionState => ({ error, success: null });

export const TRY_AGAIN = "That didn't work. Try again in a moment.";

/** A text field, trimmed; "" when missing. */
export function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/** A picker's value: "" → null (nothing chosen), an id → the id,
 *  anything else → undefined (tampered or stale form). */
export function optionalId(formData: FormData, name: string): string | null | undefined {
  const raw = text(formData, name);
  if (!raw) return null;
  return isId(raw) ? raw : undefined;
}

export function isId(value: unknown): value is string {
  return z.uuid().safeParse(value).success;
}

/** A whole or decimal number field: "" → null, invalid → undefined. */
export function optionalNumber(formData: FormData, name: string): number | null | undefined {
  const raw = text(formData, name).replace(/,/g, "");
  if (!raw) return null;
  if (!/^\d+(\.\d+)?$/.test(raw)) return undefined;
  return Number(raw);
}
