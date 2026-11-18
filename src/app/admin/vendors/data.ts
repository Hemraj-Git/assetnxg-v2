import "server-only";

import { contractState } from "@/lib/contracts";
import { todayIso } from "@/lib/dates";
import type { createClient } from "@/lib/supabase/server";
import type { VendorContract, VendorRow } from "./vendors-table";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CategoryOption = { id: string; code: string; name: string };

/** This client's vendors and categories (RLS limits both to it). */
export async function loadVendors(
  supabase: Supabase,
  orgId: string,
  timeZone: string,
): Promise<{ vendors: VendorRow[]; categories: CategoryOption[] }> {
  const [v, c, k] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, code, name, category_ids, contact_person, phone, email, address")
      .eq("organization_id", orgId),
    supabase.from("categories").select("id, code, name").eq("organization_id", orgId),
    supabase
      .from("contracts")
      .select("id, code, kind, vendor_id, starts_on, ends_on, asset_ids, renewed_from_id, not_renewing")
      .eq("organization_id", orgId),
  ]);
  if (k.error) throw new Error(`Could not load contracts: ${k.error.message}`);
  const today = todayIso(timeZone);
  const renewed = new Set((k.data ?? []).map((x) => x.renewed_from_id).filter(Boolean));
  const contractsOf = new Map<string, VendorContract[]>();
  for (const x of k.data ?? []) {
    if (!x.vendor_id) continue;
    const list = contractsOf.get(x.vendor_id) ?? [];
    list.push({
      code: x.code,
      kind: x.kind,
      startsOn: x.starts_on,
      endsOn: x.ends_on,
      assets: x.asset_ids.length,
      state: contractState({ startsOn: x.starts_on, endsOn: x.ends_on, notRenewing: x.not_renewing, renewed: renewed.has(x.id) }, today).state,
    });
    contractsOf.set(x.vendor_id, list);
  }
  if (v.error || !v.data) throw new Error(`Could not load vendors: ${v.error?.message ?? "no data"}`);
  if (c.error || !c.data) throw new Error(`Could not load categories: ${c.error?.message ?? "no data"}`);

  const categories = [...c.data].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const nameOf = new Map(categories.map((x) => [x.id, x.name]));

  const vendors: VendorRow[] = v.data.map((x) => ({
    id: x.id,
    code: x.code,
    name: x.name,
    categoryIds: x.category_ids,
    supplies: x.category_ids
      .map((id) => nameOf.get(id))
      .filter((n): n is string => Boolean(n))
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
    contactPerson: x.contact_person,
    phone: x.phone,
    email: x.email,
    address: x.address,
    contracts: (contractsOf.get(x.id) ?? []).sort((a, b) => b.endsOn.localeCompare(a.endsOn)),
  }));

  return { vendors, categories };
}
