import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/auth";
import { applyTableParams, parseTableParams } from "@/lib/table-params";
import { loadVendors } from "./data";
import { VENDORS_TABLE, vendorSearchText, vendorSortValue } from "./vendors-table";
import { VendorsView } from "./vendors-view";

export const metadata: Metadata = { title: "Vendors" };

// Suppliers and service companies (02 "Vendors"). They have no login; staff
// record their work. AMCs are contracts on assets, recorded with Assets.
export default async function VendorsPage({ searchParams }: PageProps<"/admin/vendors">) {
  const { ctx, supabase } = await requireAdmin();
  const { vendors, categories } = await loadVendors(supabase, ctx.brand.id);

  const query = await searchParams;
  const category =
    typeof query.category === "string" && categories.some((c) => c.id === query.category) ? query.category : null;
  const scoped = category ? vendors.filter((v) => v.categoryIds.includes(category)) : vendors;

  const params = parseTableParams(query, VENDORS_TABLE);
  const result = applyTableParams(scoped, params, { searchText: vendorSearchText, sortValue: vendorSortValue });

  return (
    <PageBody>
      <PageHeader title="Vendors" description={`${vendors.length} ${vendors.length === 1 ? "vendor" : "vendors"}`} />
      <VendorsView
        rows={result.rows}
        total={result.total}
        params={{ ...params, page: result.page }}
        everyone={vendors.length}
        category={category}
        categories={categories}
      />
    </PageBody>
  );
}
