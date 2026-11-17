import "server-only";

import { headers } from "next/headers";

/** This request's own origin, e.g. https://soms.assetnxg.app or
 *  http://soms.localhost:3000, for links in emails (password reset). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost";
  const local = /(^|\.)localhost(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto === "https" ? "https" : "http"}://${host}`;
}
