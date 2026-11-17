import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/auth";
import { loadPeopleAndDepartments } from "../data";
import { PeopleTabs } from "../people-tabs";
import { DepartmentsView } from "./departments-view";

export const metadata: Metadata = { title: "Departments" };

// The department tree and each department's head (06 §B: requisitions go to
// the requester's head, then up the tree).
export default async function DepartmentsPage() {
  const { ctx, supabase } = await requireAdmin();
  const { people, departments } = await loadPeopleAndDepartments(supabase, ctx.brand.id, ctx.user.id);

  return (
    <PageBody>
      <PageHeader
        title="People & departments"
        description={`${departments.length} ${departments.length === 1 ? "department" : "departments"}`}
      />
      <PeopleTabs active="departments" />
      <DepartmentsView
        departments={departments}
        people={people
          .map((p) => ({ userId: p.userId, name: p.name, email: p.email, pending: p.pending }))
          .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))}
      />
    </PageBody>
  );
}
