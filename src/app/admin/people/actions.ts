"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { plainDbError } from "@/lib/db-errors";
import { parseAssignableRoles, roleGroupsFor } from "@/lib/roles";
import { requestOrigin } from "@/lib/request-origin";
import { sendInvite } from "@/lib/supabase/auth-admin";
import { mergeRoles } from "./people-table";

// People & departments (Admins only). Each action re-checks the Admin on the
// server (requireAdmin); the database checks again (RLS, org_add_member,
// the keep-an-Admin and no-loop triggers) and logs every change.

export type ActionState = { error: string | null; success: string | null };

const ok = (success: string): ActionState => ({ error: null, success });
const fail = (error: string): ActionState => ({ error, success: null });

const TRY_AGAIN = "That didn't work. Try again in a moment.";

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/** "" (No department) → null; otherwise it must look like an id. */
function optionalId(formData: FormData, name: string): string | null | undefined {
  const raw = text(formData, name);
  if (!raw) return null;
  return z.uuid().safeParse(raw).success ? raw : undefined;
}

// ───────────── People ─────────────

const inviteSchema = z.object({
  email: z.email("Enter a valid email address.").transform((e) => e.toLowerCase()),
  full_name: z.string().min(1, "Enter the person's name.").max(120, "Keep the name under 120 characters."),
  phone: z
    .string()
    .max(20, "Keep the phone number under 20 characters.")
    .regex(/^[+\d\s()-]*$/, "Use digits, spaces and + ( ) - only."),
});

/**
 * Add a person: an existing account joins straight away; otherwise Supabase
 * sends the invite email (the link opens this client's address to set a
 * password) and the new account joins.
 */
export async function invitePerson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();

  const parsed = inviteSchema.safeParse({
    email: text(formData, "email"),
    full_name: text(formData, "full_name"),
    phone: text(formData, "phone"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const roles = parseAssignableRoles(formData.getAll("roles"), ctx.modules);
  if (roles.length === 0) return fail("Choose at least one role.");
  const department = optionalId(formData, "department_id");
  if (department === undefined) return fail("Choose a department from the list.");

  const add = () =>
    supabase.rpc("org_add_member", {
      p_org: ctx.brand.id,
      p_email: parsed.data.email,
      p_roles: roles,
      p_department: department ?? undefined,
    });

  const first = await add();
  if (first.error) return fail(plainDbError(first.error, TRY_AGAIN));
  if (first.data === "added") {
    refresh();
    return ok(`${parsed.data.email} already had an AssetNXG account and can sign in now.`);
  }
  if (first.data === "already_member") return fail(`${parsed.data.email} is already in ${ctx.brand.name}.`);

  const sent = await sendInvite(parsed.data.email, `${await requestOrigin()}/auth/confirm?next=/set-password`, {
    full_name: parsed.data.full_name,
    phone: parsed.data.phone || undefined,
  });
  if (!sent.ok && sent.reason === "failed") {
    console.error("invite email failed", sent.message);
    return fail("The invite email could not be sent. Try again in a moment.");
  }

  const second = await add();
  if (second.error) return fail(plainDbError(second.error, TRY_AGAIN));
  if (second.data !== "added" && second.data !== "already_member") {
    return fail("The invite was sent, but the new account wasn't ready yet. Try again in a minute.");
  }
  refresh();
  return ok(`Invite sent to ${parsed.data.email}. They choose a password from the email, then sign in.`);
}

/** Change a person's roles and department. Your own roles can't change. */
export async function updatePerson(membershipId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!z.uuid().safeParse(membershipId).success) return fail(TRY_AGAIN);

  const current = await supabase
    .from("memberships")
    .select("user_id, roles")
    .eq("id", membershipId)
    .eq("organization_id", ctx.brand.id)
    .eq("support_access", false)
    .maybeSingle();
  if (current.error) return fail(TRY_AGAIN);
  if (!current.data) return fail("This person is no longer in the organisation. Refresh the page.");

  const department = optionalId(formData, "department_id");
  if (department === undefined) return fail("Choose a department from the list.");

  const isMe = current.data.user_id === ctx.user.id;
  const offered = roleGroupsFor(ctx.modules).flatMap((g) => g.roles.map((r) => r.role));
  const roles = isMe
    ? current.data.roles
    : mergeRoles(parseAssignableRoles(formData.getAll("roles"), ctx.modules), current.data.roles, offered);
  if (roles.length === 0) return fail("Choose at least one role.");

  const { error } = await supabase
    .from("memberships")
    .update(isMe ? { department_id: department } : { roles, department_id: department })
    .eq("id", membershipId)
    .eq("organization_id", ctx.brand.id);
  if (error) return fail(plainDbError(error, TRY_AGAIN));

  refresh();
  return ok("Saved.");
}

/** Take a person out of this organisation (their account stays). */
export async function removePerson(membershipId: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!z.uuid().safeParse(membershipId).success) return fail(TRY_AGAIN);

  const { data, error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", membershipId)
    .eq("organization_id", ctx.brand.id)
    .eq("support_access", false)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail("This person is no longer in the organisation. Refresh the page.");

  refresh();
  return ok("Removed. Their access to this organisation has ended.");
}

/** Send the invite email again to someone who hasn't signed in yet. */
export async function resendInvite(userId: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!z.uuid().safeParse(userId).success) return fail(TRY_AGAIN);

  // Only someone in this client, never signed in, and not a support login.
  const member = await supabase
    .from("memberships")
    .select("profile:profiles!memberships_user_id_fkey(email, full_name, first_signed_in_at, is_support)")
    .eq("organization_id", ctx.brand.id)
    .eq("user_id", userId)
    .eq("support_access", false)
    .maybeSingle();
  const profile = member.data?.profile;
  if (member.error || !profile?.email || profile.is_support) return fail(TRY_AGAIN);
  if (profile.first_signed_in_at) return fail("They have already signed in, so there's no invite to resend.");

  const sent = await sendInvite(profile.email, `${await requestOrigin()}/auth/confirm?next=/set-password`);
  if (!sent.ok) {
    console.error("resend invite failed", sent.reason, sent.message);
    return fail(
      sent.reason === "exists"
        ? "They have already set a password. They can sign in, or use Forgot password."
        : "The invite email could not be sent. Try again in a moment.",
    );
  }
  return ok(`Invite sent again to ${profile.email}.`);
}

// ───────────── Departments ─────────────

const departmentSchema = z.object({
  name: z.string().min(1, "Enter the department's name.").max(80, "Keep the name under 80 characters."),
  description: z.string().max(500, "Keep the description under 500 characters."),
});

/** Add (id = null) or edit a department. */
export async function saveDepartment(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (id !== null && !z.uuid().safeParse(id).success) return fail(TRY_AGAIN);

  const parsed = departmentSchema.safeParse({
    name: text(formData, "name"),
    description: text(formData, "description"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const parent = optionalId(formData, "parent_id");
  const head = optionalId(formData, "head_user_id");
  if (parent === undefined || head === undefined) return fail("Choose from the lists.");

  const values = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    parent_id: parent,
    head_user_id: head,
  };
  const duplicate = `There is already a department called “${parsed.data.name}”.`;

  if (id === null) {
    const { error } = await supabase.from("departments").insert({ ...values, organization_id: ctx.brand.id });
    if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
    refresh();
    return ok(`${parsed.data.name} added.`);
  }

  const { data, error } = await supabase
    .from("departments")
    .update(values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
  if (!data?.length) return fail("This department no longer exists. Refresh the page.");
  refresh();
  return ok("Saved.");
}

export async function deleteDepartment(id: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return fail(TRY_AGAIN);

  const { data, error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail("This department no longer exists. Refresh the page.");
  refresh();
  return ok("Department deleted.");
}
