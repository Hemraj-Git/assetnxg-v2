import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { requireAdminModule } from "@/lib/auth";
import { currencySymbol, formatAmount } from "@/lib/money";
import { applyTableParams, formatCount, parseTableParams } from "@/lib/table-params";
import { loadAssetRefs } from "../assets/data";
import { refMaps } from "../assets/rows";
import { loadSpares, toSpareRow } from "./data";
import { SPARES_TABLE, applySpareFilters, parseSpareFilters, spareSearchText, spareSortValue } from "./spares-table";
import { SparesView } from "./spares-view";

export const metadata: Metadata = { title: "Spares & inventory" };

// Spares in stock (02 "Spares (Inventory Hub)"; Spares module): low and out
// of stock first to hand, search, category filter.
export default async function SparesPage({ searchParams }: PageProps<"/admin/spares">) {
  const { ctx, supabase } = await requireAdminModule("spares");
  const [refs, records] = await Promise.all([loadAssetRefs(supabase, ctx.brand.id), loadSpares(supabase, ctx.brand.id)]);
  const maps = refMaps(refs);
  const all = records.map((s) => toSpareRow(s, maps));

  const query = await searchParams;
  const filters = parseSpareFilters(query, new Set(refs.categories.map((c) => c.id)));
  const params = parseTableParams(query, SPARES_TABLE);
  const result = applyTableParams(applySpareFilters(all, filters), params, { searchText: spareSearchText, sortValue: spareSortValue });

  const low = all.filter((s) => s.state === "low").length;
  const out = all.filter((s) => s.state === "out").length;
  const value = all.reduce((sum, s) => sum + (s.value ?? 0), 0);
  const ready = refs.subCategories.length > 0;

  return (
    <PageBody>
      <PageHeader
        title="Spares & inventory"
        description={
          all.length === 0
            ? "Spare parts and equipment in store, with their stock and history."
            : `${formatCount(all.length)} ${all.length === 1 ? "spare" : "spares"}${value ? ` · ${currencySymbol()} ${formatAmount(value)} in stock` : ""}`
        }
        actions={
          ready ? (
            <Button asChild>
              <Link href="/admin/spares/new">
                <Plus aria-hidden /> Add spare
              </Link>
            </Button>
          ) : undefined
        }
      />
      {query.deleted === "1" && <FormMessage tone="success">Spare deleted.</FormMessage>}
      {!ready && <FormMessage tone="error">Before adding spares, add at least one sub-category (Categories).</FormMessage>}
      <SparesView
        rows={result.rows}
        total={result.total}
        params={{ ...params, page: result.page }}
        everyone={all.length}
        low={low}
        out={out}
        filters={filters}
        categories={refs.categories.map((c) => ({ id: c.id, name: c.name }))}
        canAdd={ready}
      />
    </PageBody>
  );
}
