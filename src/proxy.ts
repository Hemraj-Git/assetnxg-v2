import { NextResponse, type NextRequest } from "next/server";
import { isConsoleHost } from "@/lib/org-slug";
import { updateSession } from "@/lib/supabase/proxy";

const PROTECTED_PREFIXES = ["/admin", "/console", "/set-password"];
const SIGN_IN = "/sign-in";

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // Optimistic redirects only. Pages, Server Actions and RLS do the real checks.
  if (!userId && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = SIGN_IN;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return withCookies(NextResponse.redirect(url), response);
  }

  if (userId && pathname === SIGN_IN) {
    const url = request.nextUrl.clone();
    url.pathname = isConsoleHost(request.headers.get("host")) ? "/console" : "/admin";
    url.search = "";
    return withCookies(NextResponse.redirect(url), response);
  }

  return response;
}

// A redirect must carry any session cookies refreshed by updateSession.
function withCookies(redirect: NextResponse, from: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  const cacheControl = from.headers.get("cache-control");
  if (cacheControl) redirect.headers.set("cache-control", cacheControl);
  return redirect;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
