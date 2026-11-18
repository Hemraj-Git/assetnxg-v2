import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/auth";
import { departmentTree } from "@/lib/departments";
import { roleGroupsFor } from "@/lib/roles";
import { applyTableParams, parseTableParams } from "@/lib/table-params";
import { loadPeopleAndDepartments } from "./data";
import { PeopleTabs } from "./people-tabs";
import { PEOPLE_TABLE, personSearchText, personSortValue } from "./people-table";
import { PeopleView } from "./people-view";

export const metadata: Metadata = { title: "People" };

// Staff of this organisation: invite, roles, department, remove (02 People).
export default async function PeoplePage({ searchParams }: PageProps<"/admin/people">) {
  const { ctx, supabase } = await requireAdmin();
  const { people, departments } = await loadPeopleAndDepartments(supabase, ctx.brand.id, ctx.user.id, ctx.timeZone);

  const params = parseTableParams(await searchParams, PEOPLE_TABLE);
  const result = applyTableParams(people, params, { searchText: personSearchText, sortValue: personSortValue });
  const pending = people.filter((p) => p.pending).length;

  return (
    <PageBody>
      <PageHeader
        title="People & departments"
        description={`${people.length} ${people.length === 1 ? "person" : "people"}${pending ? `, ${pending} not signed in yet` : ""}`}
      />
      <PeopleTabs active="people" />
      <PeopleView
        rows={result.rows}
        total={result.total}
        params={{ ...params, page: result.page }}
        everyone={people.length}
        departments={departmentTree(departments).map((d) => ({ id: d.id, path: d.path }))}
        roleGroups={roleGroupsFor(ctx.modules)}
        timeZone={ctx.timeZone}
        staff={people
          .map((p) => ({ userId: p.userId, name: p.name, email: p.email }))
          .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))}
        hasDirector={people.some((p) => p.roles.includes("director"))}
      />
    </PageBody>
  );
}
