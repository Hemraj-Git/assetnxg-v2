import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { applyTableParams, formatCount, parseTableParams } from "@/lib/table-params";
import { ASSETS_TABLE, applyAssetFilters, assetSearchText, assetSortValue, parseAssetFilters, statusCounts } from "./assets-table";
import { AssetsView } from "./assets-view";
import { loadAssetRefs, loadAssets } from "./data";
import { refMaps, toAssetRow } from "./rows";

export const metadata: Metadata = { title: "Assets" };

// Every asset of this client: search, filters, status tabs, bulk status
// change (02 "Assets"; canvas 1a).
export default async function AssetsPage({ searchParams }: PageProps<"/admin/assets">) {
  const { ctx, supabase } = await requireAdmin();
  const [refs, records] = await Promise.all([loadAssetRefs(supabase, ctx.brand.id), loadAssets(supabase, ctx.brand.id)]);
  const maps = refMaps(refs);
  const all = records.map((a) => toAssetRow(a, maps));

  const query = await searchParams;
  const filters = parseAssetFilters(query, {
    campus: new Set(refs.campuses.map((x) => x.id)),
    building: new Set(refs.buildings.map((x) => x.id)),
    room: new Set(refs.rooms.map((x) => x.id)),
    category: new Set(refs.categories.map((x) => x.id)),
    sub: new Set(refs.subCategories.map((x) => x.id)),
  });
  // Status tabs count within the other filters.
  const withoutStatus = applyAssetFilters(all, { ...filters, status: null });
  const counts = statusCounts(withoutStatus);
  const filtered = filters.status ? withoutStatus.filter((a) => a.status === filters.status) : withoutStatus;

  const params = parseTableParams(query, ASSETS_TABLE);
  const result = applyTableParams(filtered, params, { searchText: assetSearchText, sortValue: assetSortValue });
  const campuses = new Set(all.map((a) => a.campusId)).size;
  const ready = refs.rooms.length > 0 && refs.subCategories.length > 0;

  return (
    <PageBody>
      <PageHeader
        title="Assets"
        description={
          all.length === 0
            ? "Everything you maintain: equipment, fittings and furniture."
            : `${formatCount(all.length)} ${all.length === 1 ? "asset" : "assets"}${campuses > 1 ? ` across ${campuses} campuses` : ""}`
        }
        actions={
          ready ? (
            <Button asChild>
              <Link href="/admin/assets/new">
                <Plus aria-hidden /> Add asset
              </Link>
            </Button>
          ) : undefined
        }
      />
      {query.deleted === "1" && <FormMessage tone="success">Asset deleted.</FormMessage>}
      {!ready && (
        <FormMessage tone="error">
          Before adding assets, add at least one room (Locations) and one sub-category (Categories).
        </FormMessage>
      )}
      <AssetsView
        rows={result.rows}
        total={result.total}
        params={{ ...params, page: result.page }}
        everyone={all.length}
        counts={counts}
        filters={filters}
        refs={{
          campuses: refs.campuses,
          buildings: refs.buildings,
          rooms: refs.rooms.map((r) => ({ id: r.id, name: r.name, buildingId: r.buildingId })),
          categories: refs.categories,
          subCategories: refs.subCategories.map((s) => ({ id: s.id, name: s.name, categoryId: s.categoryId })),
        }}
        canAdd={ready}
      />
    </PageBody>
  );
}
