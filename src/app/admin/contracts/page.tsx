import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/auth";
import { applyTableParams, formatCount, parseTableParams } from "@/lib/table-params";
import { ContractsView } from "./contracts-view";
import {
  CONTRACTS_TABLE,
  applyContractFilters,
  contractSearchText,
  contractSortValue,
  parseContractFilters,
} from "./contracts-table";
import { loadContractRefs, loadContracts } from "./data";
import { loadContractOptions, loadDocuments } from "../documents/data";

export const metadata: Metadata = { title: "Warranty & AMC" };

// Warranty and AMC contracts covering assets (owner, 18-11-2026; 06 §A).
// Recording is core; reminders come with the Warranty & AMC module.
export default async function ContractsPage({ searchParams }: PageProps<"/admin/contracts">) {
  const { ctx, supabase } = await requireAdmin();
  const refs = await loadContractRefs(supabase, ctx.brand.id);
  const [all, contractOptions] = await Promise.all([
    loadContracts(supabase, ctx.brand.id, ctx.timeZone, refs),
    loadContractOptions(supabase, ctx.brand.id, refs.vendors),
  ]);
  const documents = await loadDocuments(supabase, ctx.brand.id, { assets: refs.assets, contracts: contractOptions });

  const query = await searchParams;
  const filters = parseContractFilters(query);
  const params = parseTableParams(query, CONTRACTS_TABLE);
  const result = applyTableParams(applyContractFilters(all, filters), params, {
    searchText: contractSearchText,
    sortValue: contractSortValue,
  });
  const attention = all.filter((c) => c.state === "ends_soon" || c.state === "ended").length;

  return (
    <PageBody>
      <PageHeader
        title="Warranty & AMC"
        description={
          all.length === 0
            ? "Warranties and maintenance contracts, each covering one asset or many."
            : `${formatCount(all.length)} ${all.length === 1 ? "contract" : "contracts"}${
                attention ? `, ${attention} ending or ended without a renewal` : ""
              }`
        }
      />
      <ContractsView
        rows={result.rows}
        total={result.total}
        params={{ ...params, page: result.page }}
        everyone={all.length}
        attention={attention}
        filters={filters}
        refs={refs}
        documents={documents}
        timeZone={ctx.timeZone}
      />
    </PageBody>
  );
}
