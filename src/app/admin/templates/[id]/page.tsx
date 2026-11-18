import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { FormMessage } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/templates";
import { loadTemplate } from "../data";
import { TemplateEditor } from "../template-editor";

export const metadata: Metadata = { title: "Checklist template" };

// Params are read at request time, inside the admin layout's <Suspense>.
export default async function TemplatePage({ params, searchParams }: PageProps<"/admin/templates/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { ctx, supabase } = await requireAdmin();
  const template = await loadTemplate(supabase, ctx.brand.id, id);
  if (!template) notFound();

  return (
    <PageBody>
      {query.added === "1" && <FormMessage tone="success">Template created.</FormMessage>}
      {query.saved === "1" && <FormMessage tone="success">Saved.</FormMessage>}
      <PageHeader
        title={template.title}
        description={`${KIND_LABEL[template.kind]} template · version ${template.version} · last edited ${formatDate(template.updatedAt, ctx.timeZone)}`}
      />
      <TemplateEditor key={`${template.id}-${template.version}-${template.updatedAt}`} kind={template.kind} template={template} usedBy={template.usedBy} />
    </PageBody>
  );
}
