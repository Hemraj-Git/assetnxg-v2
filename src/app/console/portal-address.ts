// How a client's portal address is shown in the console (production form).
// Links built for a request (invites) use clientOrigin() from the console's
// actual host, so they also work on console.localhost.
export function portalAddress(slug: string): string {
  return `${slug}.assetnxg.app`;
}
