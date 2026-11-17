"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";

// The bell's only writes: mark read and dismiss, on the person's own rows in
// this client. The database allows nothing else (column grants + RLS, see
// supabase/migrations/*_notifications.sql); the user_id filter is belt and
// braces. Each action refreshes the page so the bell shows the new state.

const ids = z.array(z.uuid()).min(1).max(200);

/** Mark these notifications read. Unknown or foreign ids change nothing. */
export async function markNotificationsRead(input: string[]): Promise<void> {
  const parsed = ids.safeParse(input);
  if (!parsed.success) return;
  const { ctx, supabase } = await requireMember();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", parsed.data)
    .eq("user_id", ctx.user.id)
    .is("read_at", null);
  if (error) throw new Error(`Could not mark notifications read: ${error.message}`);
  refresh();
}

/** Mark every unread notification in this client read. */
export async function markAllNotificationsRead(): Promise<void> {
  const { ctx, supabase } = await requireMember();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", ctx.brand.id)
    .eq("user_id", ctx.user.id)
    .is("read_at", null)
    .is("dismissed_at", null);
  if (error) throw new Error(`Could not mark notifications read: ${error.message}`);
  refresh();
}

/** Remove one notification from the bell (it stays in the database). */
export async function dismissNotification(id: string): Promise<void> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return;
  const { ctx, supabase } = await requireMember();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: now })
    .eq("id", parsed.data)
    .eq("user_id", ctx.user.id);
  if (error) throw new Error(`Could not dismiss the notification: ${error.message}`);

  // Dismissing an unread one also reads it, so it stops counting.
  await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("id", parsed.data)
    .eq("user_id", ctx.user.id)
    .is("read_at", null);
  refresh();
}
