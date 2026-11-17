// Password rules shown as a live checklist and enforced by the Server Action.
// docs/context/03-business-rules.md §11: "minimum length plus lower, upper,
// digit and symbol", as set in Supabase Auth; the canvas sets 12 characters
// and "doesn't contain your name or email". Supabase Auth must be set to at
// least the same (Authentication › Policies), because it is the final check
// for anyone calling Auth directly; it also refuses leaked passwords when
// leaked-password protection is on.

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordCheck = { id: "length" | "case" | "number" | "symbol" | "personal"; label: string; ok: boolean };

/** Words from the person's email and name that a password must not contain. */
function personalWords(email?: string | null, name?: string | null): string[] {
  const local = (email ?? "").split("@")[0] ?? "";
  return [...local.split(/[._+\-\d]+/), ...(name ?? "").split(/\s+/)]
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 3);
}

export function passwordChecks(
  password: string,
  person: { email?: string | null; name?: string | null } = {},
): PasswordCheck[] {
  const lower = password.toLowerCase();
  const words = personalWords(person.email, person.name);

  return [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, ok: Array.from(password).length >= PASSWORD_MIN_LENGTH },
    { id: "case", label: "Upper and lower case letters", ok: /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password) },
    { id: "number", label: "At least one number", ok: /\p{Nd}/u.test(password) },
    { id: "symbol", label: "At least one symbol, such as - ! or #", ok: /[^\p{L}\p{N}\s]/u.test(password) },
    {
      id: "personal",
      label: "Doesn't contain your name or email",
      ok: password.length > 0 && !words.some((w) => lower.includes(w)),
    },
  ];
}

export function passwordAcceptable(password: string, person: { email?: string | null; name?: string | null } = {}): boolean {
  return passwordChecks(password, person).every((c) => c.ok);
}
