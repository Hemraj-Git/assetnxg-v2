"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Browser client: for Realtime subscriptions ONLY (architecture rule in
 * CLAUDE.md). Reads and writes go through Server Components and Server
 * Actions with the server client, so validation and RLS live in one place.
 *
 * Literal process.env access so Next.js inlines the public values.
 */
export function createRealtimeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase public settings are missing from the build.");
  }
  return createBrowserClient<Database>(url, key);
}
