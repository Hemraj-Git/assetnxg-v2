import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { NotificationItem } from "./notifications";

/** How many the bell shows; older ones stay in the database. */
export const BELL_LIMIT = 50;

export type BellData = { items: NotificationItem[]; unread: number };

/**
 * The bell's list for the signed-in person in this client: newest first,
 * dismissed ones left out, plus the unread count (which may exceed the list).
 * `supabase` must be the client scoped to this organisation (requireMember).
 */
export async function loadBell(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string,
): Promise<BellData> {
  const [list, unread] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, ref_table, ref_id, ref_number, read_at, created_at")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(BELL_LIMIT),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .is("dismissed_at", null)
      .is("read_at", null),
  ]);

  const failed = list.error ?? unread.error;
  if (failed) throw new Error(`Could not load notifications: ${failed.message}`);

  return {
    items: (list.data ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      refTable: n.ref_table,
      refId: n.ref_id,
      refNumber: n.ref_number,
      read: n.read_at !== null,
      createdAt: n.created_at,
    })),
    unread: unread.count ?? 0,
  };
}
