import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CirclePause, Plus } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { ALL_MODULES, MODULE_INFO } from "@/lib/modules";
import { portalAddress } from "./portal-address";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data: clients, error } = await supabase.rpc("platform_organizations");
  if (error) throw new Error(`Could not load clients: ${error.message}`);

  return (
    <PageBody>
      <PageHeader
        title="Clients"
        description="Each client has its own portal address, people, modules and data."
        actions={
          <Button asChild>
            <Link href="/console/new" className="no-underline">
              <Plus aria-hidden /> New client
            </Link>
          </Button>
        }
      />

      {clients.length === 0 ? (
        <section className="rounded-md border border-border bg-surface p-8 text-center">
          <h2 className="text-card">No clients yet</h2>
          <p className="mt-1 text-small text-text-2">Create the first one to give it its own portal.</p>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-cell">
            <thead>
              <tr className="border-b border-border bg-sunken text-left text-xs font-semibold tracking-[.03em] text-text-3 uppercase">
                <th scope="col" className="px-4 py-2.5">Client</th>
                <th scope="col" className="px-4 py-2.5">Portal address</th>
                <th scope="col" className="px-4 py-2.5">Status</th>
                <th scope="col" className="px-4 py-2.5">Modules</th>
                <th scope="col" className="px-4 py-2.5 text-right">People</th>
                <th scope="col" className="px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-row-hover">
                  <td className="px-4 py-3">
                    <Link href={`/console/${c.id}`} className="font-medium">
                      {c.name}
                    </Link>
                    <div className="text-xs text-text-3">{c.short_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="id">{portalAddress(c.slug)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.status === "suspended" ? (
                      <StatusChip tone="warning" icon={CirclePause}>Paused</StatusChip>
                    ) : (
                      <StatusChip tone="success" icon={CircleCheck}>Active</StatusChip>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-2">
                    {c.modules.length === ALL_MODULES.length
                      ? "All modules"
                      : c.modules.length === 0
                        ? "Core only"
                        : c.modules.map((m) => MODULE_INFO[m].label).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.member_count}
                    <span className="text-text-3"> · {c.admin_count} admin{c.admin_count === 1 ? "" : "s"}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-text-2">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageBody>
  );
}
