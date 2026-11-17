import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingInPhase, PageBody, PageHeader } from "@/components/shell/page-header";
import { findNavLeaf, navSectionParams } from "@/components/shell/nav-config";
import { requireModule } from "@/lib/auth";

// One page for every section a later phase delivers, so the navigation works
// end to end now. Each real section replaces its entry with its own route.

type Props = PageProps<"/admin/[...section]">;

export function generateStaticParams() {
  return navSectionParams();
}

function leafFor(section: string[]) {
  return findNavLeaf(`/admin/${section.join("/")}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const leaf = leafFor((await params).section);
  return { title: leaf?.label ?? "Page not found" };
}

// An address outside generateStaticParams is only known at request time, so
// params are read inside <Suspense> (Cache Components).
export default function SectionPage({ params }: Props) {
  return (
    <Suspense fallback={<PageBody><span aria-hidden className="block h-7 w-48 animate-pulse rounded-sm bg-skel" /></PageBody>}>
      <Section params={params} />
    </Suspense>
  );
}

async function Section({ params }: Pick<Props, "params">) {
  const leaf = leafFor((await params).section);
  if (!leaf) notFound();

  // A module the client doesn't have is "not found", as if the page didn't
  // exist; the database refuses its rows anyway.
  await requireModule(leaf.module);

  return (
    <PageBody>
      <PageHeader title={leaf.label} />
      <ComingInPhase phase={leaf.phase} what={leaf.label} />
    </PageBody>
  );
}
