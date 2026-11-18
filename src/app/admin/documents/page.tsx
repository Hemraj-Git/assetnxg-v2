import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/auth";
import { formatFileSize } from "@/lib/documents";
import { applyTableParams, formatCount, parseTableParams } from "@/lib/table-params";
import { loadContractRefs } from "../contracts/data";
import { loadContractOptions, loadDocuments } from "./data";
import {
  DOCUMENTS_TABLE,
  applyDocumentFilters,
  documentSearchText,
  documentSortValue,
  parseDocumentFilters,
} from "./documents-table";
import { DocumentsView } from "./documents-view";

export const metadata: Metadata = { title: "Documents" };

// Documents library (02 "Documents"): invoices, warranty cards, user guides
// and AMC contracts, linked to assets and contracts. Files are private to
// this client and open through short-lived links.
export default async function DocumentsPage({ searchParams }: PageProps<"/admin/documents">) {
  const { ctx, supabase } = await requireAdmin();
  const assetRefs = await loadContractRefs(supabase, ctx.brand.id);
  const contracts = await loadContractOptions(supabase, ctx.brand.id, assetRefs.vendors);
  const all = await loadDocuments(supabase, ctx.brand.id, { assets: assetRefs.assets, contracts });

  const query = await searchParams;
  const filters = parseDocumentFilters(query);
  const params = parseTableParams(query, DOCUMENTS_TABLE);
  const result = applyTableParams(applyDocumentFilters(all, filters), params, {
    searchText: documentSearchText,
    sortValue: documentSortValue,
  });
  const unlinked = all.filter((d) => d.assetIds.length + d.contractIds.length === 0).length;
  const bytes = all.reduce((sum, d) => sum + d.fileSize, 0);

  return (
    <PageBody>
      <PageHeader
        title="Documents"
        description={
          all.length === 0
            ? "Invoices, warranty cards, user guides and AMC contracts, linked to the assets they belong to."
            : `${formatCount(all.length)} ${all.length === 1 ? "document" : "documents"} · ${formatFileSize(bytes)}${
                unlinked ? ` · ${unlinked} not linked to anything` : ""
              }`
        }
      />
      <DocumentsView
        rows={result.rows}
        total={result.total}
        params={{ ...params, page: result.page }}
        everyone={all.length}
        unlinked={unlinked}
        filters={filters}
        refs={{ assets: assetRefs.assets, categories: assetRefs.categories, buildings: assetRefs.buildings, contracts }}
        timeZone={ctx.timeZone}
      />
    </PageBody>
  );
}
