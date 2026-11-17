import "server-only";

import { departmentTree } from "@/lib/departments";
import type { createClient } from "@/lib/supabase/server";
import type { DepartmentRow, PersonRow } from "./people-table";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The client's staff and departments, read as the signed-in Admin (RLS
 *  limits both to this client). Guests, support logins and AssetNXG support
 *  access are never listed (CLAUDE.md). */
export async function loadPeopleAndDepartments(
  supabase: Supabase,
  orgId: string,
  myId: string,
): Promise<{ people: PersonRow[]; departments: DepartmentRow[] }> {
  const [members, depts] = await Promise.all([
    supabase
      .from("memberships")
      .select(
        "id, user_id, roles, department_id, created_at, profile:profiles!memberships_user_id_fkey(full_name, email, phone, first_signed_in_at, is_support)",
      )
      .eq("organization_id", orgId)
      .eq("support_access", false),
    supabase
      .from("departments")
      .select("id, code, name, description, parent_id, head_user_id")
      .eq("organization_id", orgId),
  ]);
  if (members.error) throw new Error(`Could not load people: ${members.error.message}`);
  if (depts.error) throw new Error(`Could not load departments: ${depts.error.message}`);

  const staff = members.data.filter(
    (m) => m.profile && !m.profile.is_support && m.roles.some((r) => r !== "guest"),
  );

  const tree = departmentTree(
    depts.data.map((d) => ({ id: d.id, name: d.name, parentId: d.parent_id })),
  );
  const pathOf = new Map(tree.map((d) => [d.id, d.path]));
  const nameOf = new Map(staff.map((m) => [m.user_id, m.profile?.full_name || m.profile?.email || "Unnamed"]));

  const people: PersonRow[] = staff.map((m) => ({
    membershipId: m.id,
    userId: m.user_id,
    name: nameOf.get(m.user_id) ?? "Unnamed",
    email: m.profile?.email ?? "",
    phone: m.profile?.phone ?? null,
    roles: m.roles.filter((r) => r !== "guest"),
    departmentId: m.department_id,
    departmentPath: m.department_id ? (pathOf.get(m.department_id) ?? null) : null,
    heads: depts.data
      .filter((d) => d.head_user_id === m.user_id)
      .map((d) => pathOf.get(d.id) ?? d.name),
    pending: !m.profile?.first_signed_in_at,
    addedAt: m.created_at,
    firstSignedInAt: m.profile?.first_signed_in_at ?? null,
    isMe: m.user_id === myId,
  }));

  const count = new Map<string, number>();
  for (const m of staff) {
    if (m.department_id) count.set(m.department_id, (count.get(m.department_id) ?? 0) + 1);
  }

  const departments: DepartmentRow[] = depts.data.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description,
    parentId: d.parent_id,
    headUserId: d.head_user_id,
    headName: d.head_user_id ? (nameOf.get(d.head_user_id) ?? null) : null,
    peopleCount: count.get(d.id) ?? 0,
  }));

  return { people, departments };
}
