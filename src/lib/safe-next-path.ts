/**
 * Where to send someone after sign-in. Only same-site paths are allowed, so a
 * crafted link (?next=https://evil.example) cannot bounce users off-site.
 */
export function safeNextPath(value: unknown, fallback = "/admin"): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();

  // Must be a path on this site: starts with one "/", not "//" or "/\".
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }
  // No control characters or backslashes (browsers treat "\" like "/").
  if (/[\u0000-\u001f\u007f\\]/.test(path)) return fallback;
  // Never loop back to the sign-in page.
  if (path === "/sign-in" || path.startsWith("/sign-in?")) return fallback;

  return path;
}
