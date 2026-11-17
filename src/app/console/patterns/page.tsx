import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requirePlatformAdmin } from "@/lib/auth";
import { applyTableParams, parseTableParams } from "@/lib/table-params";
import { ChartsDemo, DialogDemo, TableDemo } from "./patterns-demo";
import { ASSET_TABLE, SAMPLE_ASSETS, assetSearchText, assetSortValue } from "./sample-data";

export const metadata: Metadata = { title: "Patterns" };

// The design system's shared patterns with made-up data, for AssetNXG staff to
// review in a real browser (console only; never on a client's address).
export default async function PatternsPage({ searchParams }: PageProps<"/console/patterns">) {
  await requirePlatformAdmin();

  // Exactly what a real list page does: parse the URL, fetch that page.
  const params = parseTableParams(await searchParams, ASSET_TABLE);
  const result = applyTableParams(SAMPLE_ASSETS, params, {
    searchText: assetSearchText,
    sortValue: assetSortValue,
  });

  return (
    <PageBody>
      <PageHeader
        title="Patterns"
        description="The shared building blocks every module uses, with sample data. Nothing here is real or saved."
      />

      <Block title="Data table" note="Sort by clicking a heading. Search, page size and the page are in the address. Select rows for the bulk bar. Enter or click opens the drawer; K / J step through rows. Keys: ↑ ↓ move, Space selects, / searches, Esc clears.">
        <TableDemo rows={result.rows} total={result.total} params={{ ...params, page: result.page }} />
      </Block>

      <Block title="Dialogs" note="Cancel on the left, the action on the right. Below 640px they become bottom sheets.">
        <DialogDemo />
      </Block>

      <Block title="Charts and figures" note="Each chart has a Chart / Table switch; legend entries turn series on and off.">
        <ChartsDemo />
      </Block>
    </PageBody>
  );
}

function Block({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 pt-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-section">{title}</h2>
        <p className="max-w-3xl text-small text-text-2">{note}</p>
      </div>
      {children}
    </section>
  );
}
