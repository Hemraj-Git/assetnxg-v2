import "server-only";

import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * It acts as the signed-in user (publishable key + their session cookie), so
 * every query is limited by RLS. Never use the secret key for user requests.
 *
 * `orgId`: the client (organisation) this request is for. Sent as header
 * x-org-id, which the database uses to show ONE client per request, even to a
 * login that belongs to several and even if a query forgets to filter
 * (private.request_org_id). Use createOrgClient() from @/lib/auth for pages
 * and actions; it fills this in from the address.
 *
 * Reads cookies(), so with Cache Components any component that calls it must
 * render inside a <Suspense> boundary.
 *
 * connection() first: Supabase work is per request, and supabase-js reads
 * the clock (Date.now) for session expiry. Without it, Next.js's prerender /
 * runtime-prefetch pass reaches that clock read and errors ("encountered the
 * unstable value Date.now() while prerendering").
 */
export async function createClient(options: { orgId?: string; writeCookies?: boolean } = {}) {
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    global: options.orgId ? { headers: { "x-org-id": options.orgId } } : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Rendering never writes cookies: the proxy refreshes the session on
        // every request before anything renders, and Next.js forbids cookie
        // writes while rendering (even in the re-render after a Server
        // Action, where it raises an InvariantError). Only code that signs in,
        // signs out or changes the session passes writeCookies: true, and only
        // from a Server Action or Route Handler.
        if (!options.writeCookies) return;
        for (const { name, value, options: cookieOptions } of cookiesToSet) {
          cookieStore.set(name, value, cookieOptions);
        }
      },
    },
  });
}
