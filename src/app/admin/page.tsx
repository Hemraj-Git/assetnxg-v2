import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingInPhase, PageBody, PageHeader } from "@/components/shell/page-header";
import { getOrgContext } from "@/lib/auth";
import { formatDate, todayIso } from "@/lib/dates";
import { roleSummary } from "@/lib/roles";

export const metadata: Metadata = { title: "Dashboard" };

// Placeholder dashboard: the designed one (KPIs, "Needs attention", charts)
// comes with operations in phase 3.
export default function DashboardPage() {
  return (
    <PageBody>
      <PageHeader title="Dashboard" description={<Suspense fallback="…"><Today /></Suspense>} />
      <ComingInPhase phase={3} what="The dashboard" />
      <Suspense fallback={null}>
        <AccountCard />
      </Suspense>
    </PageBody>
  );
}

async function Today() {
  const ctx = await getOrgContext();
  const tz = ctx.status === "ok" ? ctx.timeZone : undefined;
  return <>Today is {formatDate(todayIso(tz), tz)}</>;
}

async function AccountCard() {
  const ctx = await getOrgContext();
  if (ctx.status !== "ok") return null;

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-surface p-6">
      <h2 className="text-card">Your account</h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-cell">
        <dt className="text-text-3">Organisation</dt>
        <dd>
          {ctx.brand.name} ({ctx.brand.shortName})
        </dd>
        <dt className="text-text-3">Signed in as</dt>
        <dd>{ctx.user.email}</dd>
        <dt className="text-text-3">Roles</dt>
        <dd>{roleSummary(ctx.roles)}</dd>
      </dl>
    </section>
  );
}
