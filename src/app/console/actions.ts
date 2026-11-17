"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { parseModules } from "@/lib/modules";
import { clientOrigin, isValidOrgSlug } from "@/lib/org-slug";
import { sendInvite } from "@/lib/supabase/auth-admin";

// Super-admin console actions. Each one re-checks the platform admin on the
// server (requirePlatformAdmin) and calls a platform_* database function that
// checks again and writes the audit log. Messages are plain words.

export type ActionState = { error: string | null; success: string | null };

const ok = (success: string): ActionState => ({ error: null, success });
const fail = (error: string): ActionState => ({ error, success: null });

const details = z.object({
  name: z.string().trim().min(1, "Enter the client's name.").max(120, "Keep the name under 120 characters."),
  short_name: z.string().trim().min(1, "Enter a short name.").max(20, "Keep the short name under 20 characters."),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Choose a language and region."),
  currency: z.string().regex(/^[A-Za-z]{3}$/, "Choose a currency."),
  time_zone: z.string().min(1, "Choose a time zone."),
});

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** The client's portal address, from the address the console is on. */
async function portalOrigin(slug: string): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") === "https" || !/localhost(:\d+)?$/.test(host) ? "https" : "http";
  return clientOrigin(host, slug, proto);
}

/**
 * Give an email Admin access to a client: add the account if it exists,
 * otherwise send Supabase's invite (the link lands on the client's address
 * at /auth/confirm, then /set-password) and add the new account.
 */
async function inviteOrAddAdmin(orgId: string, slug: string, rawEmail: string): Promise<ActionState> {
  const email = z.email("Enter a valid email address.").safeParse(rawEmail.trim().toLowerCase());
  if (!email.success) return fail(email.error.issues[0]?.message ?? "Enter a valid email address.");

  const { supabase } = await requirePlatformAdmin();
  const add = () => supabase.rpc("platform_add_member", { p_org: orgId, p_email: email.data, p_roles: ["admin"] });

  const first = await add();
  if (first.error) return fail(first.error.message);
  if (first.data === "added") return ok(`${email.data} is now an Admin. They sign in at ${await portalOrigin(slug)}.`);
  if (first.data === "already_member") return ok(`${email.data} already has access to this client.`);

  const origin = await portalOrigin(slug);
  const sent = await sendInvite(email.data, `${origin}/auth/confirm?next=/set-password`);
  if (!sent.ok && sent.reason === "failed") {
    return fail(`The invite email could not be sent: ${sent.message}`);
  }

  const second = await add();
  if (second.error) return fail(second.error.message);
  if (second.data !== "added" && second.data !== "already_member") {
    return fail("The invite was sent, but the account was not found afterwards. Try again in a minute.");
  }
  return ok(`Invite sent to ${email.data}. They choose a password from the email, then sign in at ${origin}.`);
}

// ───────────── Create a client ─────────────

export async function createOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePlatformAdmin();

  const parsed = details.safeParse({
    name: field(formData, "name"),
    short_name: field(formData, "short_name"),
    locale: field(formData, "locale"),
    currency: field(formData, "currency"),
    time_zone: field(formData, "time_zone"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const slug = field(formData, "slug").trim().toLowerCase();
  if (!isValidOrgSlug(slug)) {
    return fail("Use up to 40 lower-case letters, digits and hyphens for the address (not www, admin, console…).");
  }

  const { data: orgId, error } = await supabase.rpc("platform_create_organization", {
    p_name: parsed.data.name,
    p_short_name: parsed.data.short_name,
    p_slug: slug,
    p_locale: parsed.data.locale,
    p_currency: parsed.data.currency.toUpperCase(),
    p_time_zone: parsed.data.time_zone,
    p_modules: parseModules(formData.getAll("modules")),
  });
  if (error || !orgId) return fail(error?.message ?? "The client could not be created.");

  const adminEmail = field(formData, "admin_email").trim();
  let note = "created";
  if (adminEmail) {
    const invited = await inviteOrAddAdmin(orgId, slug, adminEmail);
    note = invited.error ? "created-invite-failed" : "created-invited";
  }

  redirect(`/console/${orgId}?${note}`);
}

// ───────────── Edit a client ─────────────

export async function updateOrganization(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePlatformAdmin();
  const parsed = details.safeParse({
    name: field(formData, "name"),
    short_name: field(formData, "short_name"),
    locale: field(formData, "locale"),
    currency: field(formData, "currency"),
    time_zone: field(formData, "time_zone"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const { error } = await supabase.rpc("platform_update_organization", {
    p_org: orgId,
    p_name: parsed.data.name,
    p_short_name: parsed.data.short_name,
    p_locale: parsed.data.locale,
    p_currency: parsed.data.currency.toUpperCase(),
    p_time_zone: parsed.data.time_zone,
  });
  if (error) return fail(error.message);
  refresh();
  return ok("Details saved.");
}

export async function setModules(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("platform_set_modules", {
    p_org: orgId,
    p_modules: parseModules(formData.getAll("modules")),
  });
  if (error) return fail(error.message);
  refresh();
  return ok("Modules saved. The client's menu updates on their next page load.");
}

export async function setStatus(orgId: string, status: "active" | "suspended"): Promise<ActionState> {
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("platform_set_status", { p_org: orgId, p_status: status });
  if (error) return fail(error.message);
  refresh();
  return ok(status === "suspended" ? "Client paused." : "Client resumed.");
}

export async function inviteAdmin(orgId: string, slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await inviteOrAddAdmin(orgId, slug, field(formData, "email"));
  if (!result.error) refresh();
  return result;
}

export async function setSupportAccess(orgId: string, grant: boolean): Promise<ActionState> {
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc(grant ? "platform_grant_support" : "platform_revoke_support", { p_org: orgId });
  if (error) return fail(error.message);
  refresh();
  return ok(grant ? "Support access on. It is recorded in the client's audit log." : "Support access removed.");
}

// ───────────── Logos ─────────────

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_LOGO_BYTES = 1024 * 1024;

export async function uploadLogo(
  orgId: string,
  kind: "wide" | "mark",
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePlatformAdmin();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return fail("Choose an image file.");
  const ext = LOGO_TYPES[file.type];
  if (!ext) return fail("Use a PNG, JPEG or WebP image.");
  if (file.size > MAX_LOGO_BYTES) return fail("The image is over 1 MB. Use a smaller one.");

  // A new name each time, so browsers and CDNs never show the old logo.
  const path = `${orgId}/${kind}-${crypto.randomUUID()}.${ext}`;
  const upload = await supabase.storage.from("branding").upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return fail(`Upload failed: ${upload.error.message}`);

  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  const { error } = await supabase.rpc("platform_set_logo", { p_org: orgId, p_kind: kind, p_url: data.publicUrl });
  if (error) return fail(error.message);

  refresh();
  return ok(kind === "wide" ? "Logo updated." : "Logo mark updated.");
}

export async function removeLogo(orgId: string, kind: "wide" | "mark"): Promise<ActionState> {
  const { supabase } = await requirePlatformAdmin();
  // p_url null removes the logo (the function's documented behaviour).
  const { error } = await supabase.rpc("platform_set_logo", {
    p_org: orgId,
    p_kind: kind,
    p_url: null as unknown as string,
  });
  if (error) return fail(error.message);
  refresh();
  return ok("Logo removed. The initials show instead.");
}
