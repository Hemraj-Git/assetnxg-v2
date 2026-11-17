// Initials for avatars and the no-logo brand tile: "Anita Rao" → "AR",
// "School of Maritime Studies" → "SM" (small words skipped), "admin@x" → "A".

const SMALL_WORDS = new Set(["of", "and", "the", "for", "&", "de", "la", "le"]);

export function initials(name: string | null | undefined, max = 2): string {
  const words = (name ?? "")
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter((w) => w && !SMALL_WORDS.has(w.toLowerCase()));

  const letters = words
    .slice(0, max)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .toUpperCase();

  return letters || "?";
}
