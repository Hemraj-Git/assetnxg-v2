import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Refreshes the Supabase session cookie on every request, before rendering,
 * and reports whether there is a valid signed-in user.
 *
 * This is an optimistic check for redirects only. It is NOT authorisation:
 * pages, Server Actions and RLS each check access themselves (Next.js proxy
 * guide: "Always verify authentication and authorization inside each Server
 * Function rather than relying on Proxy alone").
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Pass refreshed cookies to the page render (request) and the browser
        // (response).
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache headers from @supabase/ssr so a CDN never serves one person's
        // refreshed session to another.
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims: getClaims
  // validates the JWT and triggers the refresh that writes the cookies above.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  return { response, userId };
}
