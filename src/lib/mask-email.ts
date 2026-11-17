/**
 * "anita.rao@seaward.example" → "an•••.rao@seaward.example" (canvas · Sign-in
 * "Check your email"): enough to recognise, not enough to read over a shoulder.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const dot = local.indexOf(".");
  if (dot > 2) return `${local.slice(0, 2)}•••${local.slice(dot)}${domain}`;
  if (local.length <= 2) return `${local[0]}•••${domain}`;
  return `${local.slice(0, 2)}•••${domain}`;
}
