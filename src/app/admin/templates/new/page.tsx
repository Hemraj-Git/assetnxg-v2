import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/auth";
import { KIND_LABEL, kindsFor, type ChecklistKind } from "@/lib/templates";
import { loadTemplate } from "../data";
import { TemplateEditor } from "../template-editor";

export const metadata: Metadata = { title: "New template" };

// ?kind=pm|inspection; ?from=<id> starts from a copy (Duplicate).
export default async function NewTemplatePage({ searchParams }: PageProps<"/admin/templates/new">) {
  const { ctx, supabase } = await requireAdmin();
  const kinds = kindsFor(ctx.modules);
  const query = await searchParams;
  const kind = query.kind as ChecklistKind;
  if (!kinds.includes(kind)) notFound();

  const source = typeof query.from === "string" ? await loadTemplate(supabase, ctx.brand.id, query.from) : null;
  const copy = source && source.kind === kind ? source : null;

  return (
    <PageBody>
      <PageHeader
        title={copy ? `Copy of ${copy.title}` : `New ${KIND_LABEL[kind]} template`}
        description={kind === "pm" ? "The checklist a technician follows on a preventive job." : "The checklist an inspector follows."}
      />
      <TemplateEditor
        kind={kind}
        template={copy ? { id: null, title: `${copy.title} (copy)`, description: copy.description, repeats: copy.repeats, items: copy.items } : null}
        usedBy={[]}
      />
    </PageBody>
  );
}
