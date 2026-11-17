// Which organisation (client) a request is for, from its host name.
//
//   soms.assetnxg.app        → "soms"   (production, one subdomain per client)
//   soms.localhost:3000      → "soms"   (local dev: browsers send *.localhost
//                                        to 127.0.0.1, no hosts-file edits)
//   localhost:3000, a bare
//   domain, *.vercel.app     → null     (fall back to the DEV_ORG_SLUG setting)
//
// Brand never comes from build-time env vars as in v1: it is organisation
// data, looked up by this slug (docs/context/01-product.md, White-label).

const SLUG = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;

/** Base domains whose first label is an organisation slug. */
export const TENANT_BASE_DOMAINS = ["assetnxg.app", "localhost"] as const;

/** Labels that are never a client slug. Must match private.reserved_slugs(). */
const RESERVED = new Set(["www", "app", "api", "admin", "support", "status", "docs", "console"]);

/** The super-admin console's label: console.assetnxg.app, console.localhost. */
export const CONSOLE_LABEL = "console";

function hostnameOf(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

/** True for the super-admin console's host (never a client portal). */
export function isConsoleHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = hostnameOf(host);
  return TENANT_BASE_DOMAINS.some((base) => hostname === `${CONSOLE_LABEL}.${base}`);
}

/**
 * A client's portal address, built from the address the console is on, so
 * invite links work locally and in production:
 *   console.localhost:3000 + "pms" → http://pms.localhost:3000
 *   console.assetnxg.app   + "pms" → https://pms.assetnxg.app
 */
export function clientOrigin(consoleHost: string, slug: string, protocol: "http" | "https"): string {
  const host = consoleHost.trim().toLowerCase();
  const port = /:(\d+)$/.exec(host)?.[1];
  const hostname = hostnameOf(host);
  const base = TENANT_BASE_DOMAINS.find((b) => hostname === `${CONSOLE_LABEL}.${b}`);
  if (!base) throw new Error(`Not the console's address: ${consoleHost}`);
  if (!isValidOrgSlug(slug)) throw new Error(`Not a client address: ${slug}`);
  return `${protocol}://${slug}.${base}${port ? `:${port}` : ""}`;
}

export function orgSlugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;

  const hostname = hostnameOf(host);

  for (const base of TENANT_BASE_DOMAINS) {
    if (!hostname.endsWith(`.${base}`)) continue;

    const sub = hostname.slice(0, -(base.length + 1));
    // Only a single label: "a.b.assetnxg.app" is not a tenant.
    if (sub.includes(".")) return null;
    if (!SLUG.test(sub) || RESERVED.has(sub)) return null;
    return sub;
  }

  return null;
}

/** Validates a slug from configuration (e.g. DEV_ORG_SLUG). */
export function isValidOrgSlug(value: string | null | undefined): value is string {
  return !!value && SLUG.test(value) && !RESERVED.has(value);
}
