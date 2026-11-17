import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { moduleEnabled, type AppModule, type ModuleRequirement } from "@/lib/modules";
import { isConsoleHost, isValidOrgSlug, orgSlugFromHost } from "@/lib/org-slug";

// Data access layer for "who is this, which client is this for, and what may
// they use". Every page and Server Action asks here; the proxy's redirect is
// only a hint, and RLS checks every row regardless. React cache() dedupes the
// lookups within one request.

export type AppRole = Database["public"]["Enums"]["app_role"];

export type Brand = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  logoUrl: string | null;
  logoMarkUrl: string | null;
  status: "active" | "suspended";
};

export type OrgContext =
  | { status: "no-organisation" }
  | { status: "unknown-organisation"; slug: string }
  | { status: "suspended"; brand: Brand }
  | { status: "signed-out"; brand: Brand }
  | { status: "not-a-member"; brand: Brand; userId: string }
  | {
      status: "ok";
      brand: Brand;
      user: { id: string; email: string | null; fullName: string | null };
      roles: AppRole[];
      modules: AppModule[];
      timeZone: string;
    };

/** True when this request is for the super-admin console's address. */
export const isConsoleRequest = cache(async (): Promise<boolean> => {
  return isConsoleHost((await headers()).get("host"));
});

/** The client (organisation) slug for this request: subdomain first, else
 *  DEV_ORG_SLUG. Never a client on the console's address. */
export const getOrgSlug = cache(async (): Promise<string | null> => {
  const host = (await headers()).get("host");
  if (isConsoleHost(host)) return null;

  const fromHost = orgSlugFromHost(host);
  if (fromHost) return fromHost;

  // Local dev on plain localhost, or a preview URL: a server-only setting.
  const fallback = process.env.DEV_ORG_SLUG;
  return isValidOrgSlug(fallback) ? fallback : null;
});

/** Public brand and status for this request's client (sign-in page, shell). */
export const getBrand = cache(async (): Promise<Brand | null> => {
  const slug = await getOrgSlug();
  if (!slug) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("org_lookup", { org_slug: slug });
  if (error) throw new Error(`Could not load the organisation: ${error.message}`);

  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    slug: row.slug,
    logoUrl: row.logo_url ?? null,
    logoMarkUrl: row.logo_mark_url ?? null,
    status: row.status === "suspended" ? "suspended" : "active",
  };
});

/** The signed-in user's id from a verified JWT, or null. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});

/** Everything a page needs to decide what to show. */
export const getOrgContext = cache(async (): Promise<OrgContext> => {
  const slug = await getOrgSlug();
  if (!slug) return { status: "no-organisation" };

  const brand = await getBrand();
  if (!brand) return { status: "unknown-organisation", slug };
  if (brand.status === "suspended") return { status: "suspended", brand };

  const userId = await getUserId();
  if (!userId) return { status: "signed-out", brand };

  // Scoped to this client: the database shows nothing from any other.
  const supabase = await createClient({ orgId: brand.id });

  const [membership, profile, org, modules] = await Promise.all([
    supabase
      .from("memberships")
      .select("roles")
      .eq("organization_id", brand.id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle(),
    supabase.from("organizations").select("time_zone").eq("id", brand.id).maybeSingle(),
    supabase
      .from("organization_modules")
      .select("module")
      .eq("organization_id", brand.id)
      .eq("enabled", true),
  ]);

  const failed = membership.error ?? profile.error ?? org.error ?? modules.error;
  if (failed) throw new Error(`Could not load your account: ${failed.message}`);

  if (!membership.data || !org.data) return { status: "not-a-member", brand, userId };

  return {
    status: "ok",
    brand,
    user: {
      id: userId,
      email: profile.data?.email ?? null,
      fullName: profile.data?.full_name ?? null,
    },
    roles: membership.data.roles,
    modules: (modules.data ?? []).map((m) => m.module),
    timeZone: org.data.time_zone,
  };
});

/** Desktop pages are for Admins only (docs/context/01-product.md). */
export function isAdmin(roles: readonly AppRole[]): boolean {
  return roles.includes("admin");
}

/**
 * For pages and Server Actions that read or change client data: the signed-in
 * member's context and a Supabase client scoped to this client. Anything else
 * (signed out, wrong client, paused) stops here.
 */
export async function requireMember() {
  const ctx = await getOrgContext();
  if (ctx.status === "signed-out") redirect("/sign-in");
  if (ctx.status !== "ok") notFound();
  const supabase = await createClient({ orgId: ctx.brand.id });
  return { ctx, supabase };
}

/** As requireMember, and the client must have the module switched on. */
export async function requireModule(required: ModuleRequirement) {
  const member = await requireMember();
  if (!moduleEnabled(required, member.ctx.modules)) notFound();
  return member;
}

// ───────────── Super-admin console ─────────────

export type PlatformAdmin = { id: string; email: string | null; fullName: string | null };

/** The signed-in platform admin on the console's address, or null. */
export const getPlatformAdmin = cache(async (): Promise<PlatformAdmin | null> => {
  if (!(await isConsoleRequest())) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const [admin, profile] = await Promise.all([
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle(),
  ]);
  if (admin.error) throw new Error(`Could not check console access: ${admin.error.message}`);
  if (!admin.data) return null;

  return { id: userId, email: profile.data?.email ?? null, fullName: profile.data?.full_name ?? null };
});

/**
 * For console pages and Server Actions. Only on the console's address and
 * only for platform admins; the database checks again in every platform_*
 * function.
 */
export async function requirePlatformAdmin() {
  if (!(await isConsoleRequest())) notFound();
  if (!(await getUserId())) redirect("/sign-in?next=/console");
  const admin = await getPlatformAdmin();
  if (!admin) notFound();
  const supabase = await createClient();
  return { admin, supabase };
}
