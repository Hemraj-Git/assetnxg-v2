import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const FORMER_MEMBER = "Someone who has left";

/** Names for "who did it" columns. Support logins are never named to
 *  clients (CLAUDE.md); people no longer readable show as having left. */
export async function loadPeopleNames(supabase: Supabase, ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const { data } = await supabase.from("profiles").select("id, full_name, email, is_support").in("id", unique);
  for (const p of data ?? []) {
    names.set(p.id, p.is_support ? "AssetNXG support" : p.full_name || p.email || "Unnamed");
  }
  return names;
}
