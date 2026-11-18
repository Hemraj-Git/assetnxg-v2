import "server-only";

import { contractState } from "@/lib/contracts";
import { todayIso } from "@/lib/dates";
import type { createClient } from "@/lib/supabase/server";
import type { ContractRow } from "./contracts-table";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** An asset as the contract picker shows it. */
export type AssetOption = {
  id: string;
  code: string;
  name: string;
  /** "HVAC › Split AC" */
  category: string;
  /** "Classroom 204 · Block B" */
  location: string;
  categoryId: string;
  buildingId: string;
  retired: boolean;
};

export type VendorOption = { id: string; code: string; name: string };

const byCode = (a: { code: string }, b: { code: string }) =>
  a.code.localeCompare(b.code, "en", { numeric: true });

/** The assets and vendors a contract can point to (this client's). */
export async function loadContractRefs(
  supabase: Supabase,
  orgId: string,
): Promise<{ assets: AssetOption[]; vendors: VendorOption[]; categories: { id: string; name: string }[]; buildings: { id: string; name: string }[] }> {
  const [a, r, b, s, c, v] = await Promise.all([
    supabase.from("assets").select("id, code, name, status, room_id, sub_category_id").eq("organization_id", orgId),
    supabase.from("rooms").select("id, name, building_id").eq("organization_id", orgId),
    supabase.from("buildings").select("id, name").eq("organization_id", orgId),
    supabase.from("sub_categories").select("id, name, category_id").eq("organization_id", orgId),
    supabase.from("categories").select("id, name").eq("organization_id", orgId),
    supabase.from("vendors").select("id, code, name").eq("organization_id", orgId),
  ]);
  const failed = a.error ?? r.error ?? b.error ?? s.error ?? c.error ?? v.error;
  if (failed) throw new Error(`Could not load the lists: ${failed.message}`);

  const room = new Map((r.data ?? []).map((x) => [x.id, x]));
  const building = new Map((b.data ?? []).map((x) => [x.id, x]));
  const sub = new Map((s.data ?? []).map((x) => [x.id, x]));
  const category = new Map((c.data ?? []).map((x) => [x.id, x]));
  const byName = <T extends { name: string }>(x: T, y: T) => x.name.localeCompare(y.name, "en", { sensitivity: "base" });

  return {
    assets: (a.data ?? [])
      .map((x) => {
        const rm = room.get(x.room_id);
        const bl = rm ? building.get(rm.building_id) : undefined;
        const sc = sub.get(x.sub_category_id);
        const ct = sc ? category.get(sc.category_id) : undefined;
        return {
          id: x.id,
          code: x.code,
          name: x.name,
          category: [ct?.name, sc?.name].filter(Boolean).join(" › "),
          location: [rm?.name, bl?.name].filter(Boolean).join(" · "),
          categoryId: ct?.id ?? "",
          buildingId: bl?.id ?? "",
          retired: x.status === "retired",
        };
      })
      .sort(byCode),
    vendors: (v.data ?? []).map((x) => ({ id: x.id, code: x.code, name: x.name })).sort(byName),
    categories: (c.data ?? []).map((x) => ({ id: x.id, name: x.name })).sort(byName),
    buildings: (b.data ?? []).map((x) => ({ id: x.id, name: x.name })).sort(byName),
  };
}

type ContractQuery = { assetId?: string; vendorId?: string };

/** This client's contracts (optionally only those covering one asset, or
 *  with one vendor), with their state today. */
export async function loadContracts(
  supabase: Supabase,
  orgId: string,
  timeZone: string,
  refs: { assets: { id: string; code: string; name: string }[]; vendors: VendorOption[] },
  only: ContractQuery = {},
): Promise<ContractRow[]> {
  let q = supabase
    .from("contracts")
    .select("id, code, kind, vendor_id, contract_no, starts_on, ends_on, cost, visits_per_year, coverage, asset_ids, renewed_from_id, not_renewing")
    .eq("organization_id", orgId);
  if (only.assetId) q = q.contains("asset_ids", [only.assetId]);
  if (only.vendorId) q = q.eq("vendor_id", only.vendorId);
  const { data, error } = await q;
  if (error || !data) throw new Error(`Could not load contracts: ${error?.message ?? "no data"}`);

  // Renewals point back; to know what renewed each contract, look across all
  // of this client's renewal links (small: id → renewed_from_id).
  const links = only.assetId || only.vendorId
    ? (await supabase.from("contracts").select("id, code, renewed_from_id").eq("organization_id", orgId).not("renewed_from_id", "is", null)).data ?? []
    : data.filter((c) => c.renewed_from_id).map((c) => ({ id: c.id, code: "", renewed_from_id: c.renewed_from_id }));
  const codeOf = new Map(data.map((c) => [c.id, c.code]));
  const renewedBy = new Map(links.map((l) => [l.renewed_from_id as string, { id: l.id, code: l.code || codeOf.get(l.id) || "" }]));

  const assetOf = new Map(refs.assets.map((a) => [a.id, a]));
  const vendorOf = new Map(refs.vendors.map((v) => [v.id, v]));
  const today = todayIso(timeZone);

  return data.map((c) => {
    const by = renewedBy.get(c.id) ?? null;
    const st = contractState({ startsOn: c.starts_on, endsOn: c.ends_on, notRenewing: c.not_renewing, renewed: Boolean(by) }, today);
    return {
      id: c.id,
      code: c.code,
      kind: c.kind,
      vendorId: c.vendor_id,
      vendorName: c.vendor_id ? (vendorOf.get(c.vendor_id)?.name ?? null) : null,
      contractNo: c.contract_no,
      startsOn: c.starts_on,
      endsOn: c.ends_on,
      cost: c.cost,
      visitsPerYear: c.visits_per_year,
      coverage: c.coverage,
      assetIds: c.asset_ids,
      assets: c.asset_ids
        .map((id) => assetOf.get(id))
        .filter((a): a is { id: string; code: string; name: string } => Boolean(a))
        .sort(byCode),
      renewedFromId: c.renewed_from_id,
      renewedFromCode: c.renewed_from_id ? (codeOf.get(c.renewed_from_id) ?? null) : null,
      renewedById: by?.id ?? null,
      renewedByCode: by?.code ?? null,
      notRenewing: c.not_renewing,
      state: st.state,
      daysLeft: st.daysLeft,
    };
  });
}
