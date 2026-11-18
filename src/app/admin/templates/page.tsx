import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { SectionTabs } from "@/components/shell/section-tabs";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { KIND_LABEL, kindsFor, type ChecklistKind } from "@/lib/templates";
import { loadTemplates } from "./data";
import { TemplatesList } from "./templates-list";

export const metadata: Metadata = { title: "Checklist templates" };

// One page for PM and inspection templates (02; canvas "Checklist
// templates"). Each kind shows only when its module is on.
export default async function TemplatesPage({ searchParams }: PageProps<"/admin/templates">) {
  const { ctx, supabase } = await requireAdmin();
  const kinds = kindsFor(ctx.modules);
  if (kinds.length === 0) notFound();

  const query = await searchParams;
  const kind: ChecklistKind = kinds.includes(query.kind as ChecklistKind) ? (query.kind as ChecklistKind) : kinds[0];
  const all = await loadTemplates(supabase, ctx.brand.id);
  const rows = all.filter((t) => t.kind === kind);

  return (
    <PageBody>
      <PageHeader
        title="Checklist templates"
        description="What technicians and inspectors tick off in the field app."
        actions={
          <Button asChild>
            <Link href={`/admin/templates/new?kind=${kind}`}>
              <Plus aria-hidden /> New {KIND_LABEL[kind]} template
            </Link>
          </Button>
        }
      />
      {query.deleted === "1" && <FormMessage tone="success">Template deleted.</FormMessage>}
      {kinds.length > 1 && (
        <SectionTabs
          label="Template kind"
          active={kind}
          tabs={kinds.map((k) => ({
            key: k,
            label: k === "pm" ? "PM" : "Inspection",
            href: `/admin/templates?kind=${k}`,
            count: all.filter((t) => t.kind === k).length,
          }))}
        />
      )}
      <TemplatesList
        kind={kind}
        rows={rows.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          repeats: t.repeats,
          items: t.items.length,
          usedBy: t.usedBy,
          updatedAt: t.updatedAt,
        }))}
        timeZone={ctx.timeZone}
      />
    </PageBody>
  );
}
