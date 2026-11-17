import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, CirclePause } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { FormMessage } from "@/components/ui/field";
import { StatusChip } from "@/components/ui/status-chip";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { portalAddress } from "../portal-address";
import {
  AdminsPanel,
  DetailsPanel,
  LogoPanel,
  ModulesPanel,
  StatusPanel,
  SupportPanel,
  type ConsoleClient,
} from "./client-panels";

export const metadata: Metadata = { title: "Client" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientPage({ params, searchParams }: PageProps<"/console/[orgId]">) {
  const { orgId } = await params;
  if (!UUID.test(orgId)) notFound();

  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("platform_organizations", { p_org: orgId });
  if (error) throw new Error(`Could not load the client: ${error.message}`);
  const row = data[0];
  if (!row) notFound();

  const client: ConsoleClient = {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    slug: row.slug,
    status: row.status === "suspended" ? "suspended" : "active",
    locale: row.locale,
    currency: row.currency,
    timeZone: row.time_zone,
    logoUrl: row.logo_url ?? null,
    logoMarkUrl: row.logo_mark_url ?? null,
    memberCount: row.member_count,
    adminCount: row.admin_count,
    modules: row.modules,
    mySupportAccess: row.my_support_access,
  };

  const flags = await searchParams;

  return (
    <PageBody>
      <p className="text-small">
        <Link href="/console">← Clients</Link>
      </p>
      <PageHeader
        title={client.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="id">{portalAddress(client.slug)}</span>
            {client.status === "suspended" ? (
              <StatusChip tone="warning" icon={CirclePause}>Paused</StatusChip>
            ) : (
              <StatusChip tone="success" icon={CircleCheck}>Active</StatusChip>
            )}
            <span className="text-text-3">Created {formatDate(row.created_at)}</span>
          </span>
        }
      />

      {"created" in flags && <FormMessage tone="success">Client created. Its portal is live at its address.</FormMessage>}
      {"created-invited" in flags && (
        <FormMessage tone="success">
          Client created. The first Admin was added, or invited by email if they had no account yet.
        </FormMessage>
      )}
      {"created-invite-failed" in flags && (
        <FormMessage tone="error">
          Client created, but the Admin invite failed. Invite them again under Admins below.
        </FormMessage>
      )}

      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <DetailsPanel client={client} />
        <ModulesPanel client={client} />
        <LogoPanel client={client} />
        <AdminsPanel client={client} />
        <SupportPanel client={client} />
        <StatusPanel client={client} />
      </div>
    </PageBody>
  );
}
