import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { PageBody } from "@/components/shell/page-header";
import { FormMessage } from "@/components/ui/field";
import { ASSET_STATUS_LABEL, assetAge, specDisplay } from "@/lib/assets";
import { requireAdmin } from "@/lib/auth";
import { PRIORITY_LABEL } from "@/lib/categories";
import { formatDate, formatTime, todayIso } from "@/lib/dates";
import { currencySymbol, formatAmount } from "@/lib/money";
import { AssetStatusChip } from "../asset-status";
import { loadAsset, loadAssetActivity, loadAssetRefs, type ActivityEntry } from "../data";
import { placeOf, refMaps } from "../rows";
import { loadContractRefs, loadContracts } from "../../contracts/data";
import { loadContractOptions, loadDocumentOptions, loadDocuments } from "../../documents/data";
import { LinkedDocuments } from "../../documents/linked-documents";
import { AssetCoverPanel } from "./asset-cover-panel";
import { AssetPageActions } from "./asset-page-actions";

export const metadata: Metadata = { title: "Asset" };

const FIELD_NAMES: Record<string, string> = {
  name: "name",
  sub_category_id: "sub-category",
  room_id: "location",
  status: "status",
  sla_priority: "priority",
  manufacturer: "manufacturer",
  model: "model",
  serial_no: "serial number",
  price: "price",
  purchase_date: "purchase date",
  installation_date: "installation date",
  last_serviced_on: "last serviced date",
  purchased_from_id: "vendor",
  assigned_to: "assignee",
  spec_values: "specifications",
  notes: "note",
  retired_on: "retirement",
  retire_reason: "retirement reason",
};

// Canvas 1b · Asset page. Params are read at request time, inside the admin
// layout's <Suspense>.
export default async function AssetPage({ params, searchParams }: PageProps<"/admin/assets/[ref]">) {
  const [{ ref }, query] = await Promise.all([params, searchParams]);
  const { ctx, supabase } = await requireAdmin();
  const [asset, refs] = await Promise.all([loadAsset(supabase, ctx.brand.id, ref), loadAssetRefs(supabase, ctx.brand.id)]);
  if (!asset) notFound();
  const [activity, contractRefs] = await Promise.all([
    loadAssetActivity(supabase, ctx.brand.id, asset.id),
    loadContractRefs(supabase, ctx.brand.id),
  ]);
  const [contracts, contractOptions, library] = await Promise.all([
    loadContracts(supabase, ctx.brand.id, ctx.timeZone, contractRefs, { assetId: asset.id }),
    loadContractOptions(supabase, ctx.brand.id, contractRefs.vendors),
    loadDocumentOptions(supabase, ctx.brand.id),
  ]);
  const documents = await loadDocuments(
    supabase,
    ctx.brand.id,
    { assets: contractRefs.assets, contracts: contractOptions },
    { assetId: asset.id },
  );

  const maps = refMaps(refs);
  const { room, building, campus } = placeOf(maps, asset.roomId);
  const sub = maps.sub.get(asset.subCategoryId);
  const category = sub ? maps.category.get(sub.categoryId) : undefined;
  const vendor = asset.purchasedFromId ? maps.vendor.get(asset.purchasedFromId) : undefined;
  const person = asset.assignedTo ? maps.person.get(asset.assignedTo) : undefined;
  const today = todayIso(ctx.timeZone);
  const priority = asset.slaPriority ?? sub?.slaPriority ?? null;
  const age = assetAge(asset.installationDate ?? asset.purchaseDate, today);

  const specs = (sub?.fields ?? []).map((f) => ({ k: f.label, v: specDisplay(f, asset.specValues[f.key]) || "—" }));

  return (
    <PageBody>
      {query.added === "1" && <FormMessage tone="success">{asset.code} created.</FormMessage>}
      {query.saved === "1" && <FormMessage tone="success">Saved.</FormMessage>}
      {asset.status === "retired" && (
        <FormMessage tone="error">
          Retired on {formatDate(asset.retiredOn)}
          {asset.retireReason ? `: ${asset.retireReason}` : ""}. It stays in reports with its history.
        </FormMessage>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="id text-[13px] text-text-2">{asset.code}</span>
            <AssetStatusChip status={asset.status} />
          </div>
          <h1 className="text-page">{asset.name}</h1>
          <nav aria-label="Location" className="flex flex-wrap items-center gap-1 text-small text-text-2">
            <MapPin aria-hidden className="size-3.5 flex-none" />
            {[campus?.name, building?.name, room?.name].filter(Boolean).map((p, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden className="size-3.5 text-text-3" />}
                {p}
              </span>
            ))}
            <span className="text-text-3">· {[category?.name, sub?.name].filter(Boolean).join(" › ")}</span>
          </nav>
        </div>
        <AssetPageActions asset={{ id: asset.id, code: asset.code, name: asset.name, status: asset.status }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Age" value={age || "—"} note={asset.installationDate ? `installed ${formatDate(asset.installationDate)}` : asset.purchaseDate ? `bought ${formatDate(asset.purchaseDate)}` : "no dates recorded"} />
        <Kpi label="SLA priority" value={priority ? PRIORITY_LABEL[priority] : "—"} note={asset.slaPriority ? "set on this asset" : sub?.slaPriority ? "from the sub-category" : "requester chooses"} />
        <Kpi label="Price" value={asset.price !== null ? `${currencySymbol()} ${formatAmount(asset.price)}` : "—"} note={vendor ? `from ${vendor.name}` : "vendor not recorded"} />
        <Kpi label="Assigned to" value={person?.name ?? "No one"} note={person?.email ?? ""} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Basic information">
            <Facts
              items={[
                { k: "Manufacturer", v: asset.manufacturer ?? "—" },
                { k: "Model", v: asset.model ?? "—" },
                { k: "Serial number", v: asset.serialNo ? <span className="font-mono text-[12.5px]">{asset.serialNo}</span> : "—" },
                { k: "Status", v: ASSET_STATUS_LABEL[asset.status] },
                { k: "Note", v: asset.notes ?? "—" },
              ]}
            />
          </Panel>
          <Panel title="Purchase">
            <Facts
              items={[
                { k: "Purchase date", v: formatDate(asset.purchaseDate) || "—" },
                { k: "Installation date", v: asset.installationDate ? `${formatDate(asset.installationDate)} · locked` : "—" },
                { k: "Last serviced", v: formatDate(asset.lastServicedOn) || "—" },
                { k: "Bought from", v: vendor ? `${vendor.name} · ${vendor.code}` : "—" },
              ]}
            />
          </Panel>
          <Panel title={`Specifications${sub ? ` · from ${[category?.name, sub.name].filter(Boolean).join(" › ")}` : ""}`}>
            {specs.length ? <Facts items={specs} /> : <p className="text-small text-text-3">This sub-category has no extra fields.</p>}
          </Panel>
          <Panel title="Activity">
            <ActivityList entries={activity} people={maps.person} timeZone={ctx.timeZone} />
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <AssetCoverPanel assetId={asset.id} contracts={contracts} refs={contractRefs} today={today} />
          <Panel title={`Documents${documents.length ? ` (${documents.length})` : ""}`}>
            <LinkedDocuments
              target={{ kind: "asset", id: asset.id, label: `${asset.code} · ${asset.name}` }}
              documents={documents}
              library={library}
            />
          </Panel>
          <Panel title="PM and inspection schedules">
            <p className="text-small text-text-2">Schedules start here once checklist templates are set up.</p>
          </Panel>
          <Panel title="QR code">
            <p className="text-small text-text-2">
              The asset&apos;s QR label is ready to print once QR printing is built. Its code is fixed and never changes.
            </p>
          </Panel>
        </div>
      </div>
    </PageBody>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface px-4 py-3">
      <span className="text-xs font-medium text-text-3 uppercase">{label}</span>
      <span className="text-[20px] leading-7 font-semibold tabular-nums">{value}</span>
      {note && <span className="truncate text-small text-text-3">{note}</span>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 max-sm:p-4">
      <h2 className="text-card">{title}</h2>
      {children}
    </section>
  );
}

function Facts({ items }: { items: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.k} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-text-3">{i.k}</dt>
          <dd className="break-words text-cell">{i.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActivityList({
  entries,
  people,
  timeZone,
}: {
  entries: ActivityEntry[];
  people: Map<string, { name: string }>;
  timeZone: string;
}) {
  if (entries.length === 0) return <p className="text-small text-text-3">No changes recorded yet.</p>;
  return (
    <ol className="flex flex-col">
      {entries.map((e, i) => {
        const who = e.actorId ? (people.get(e.actorId)?.name ?? "Someone") : "AssetNXG";
        const what =
          e.action === "insert"
            ? "Added the asset"
            : e.changed.includes("status") && e.status
              ? `Changed the status to ${ASSET_STATUS_LABEL[e.status]}${e.changed.length > 2 ? " and other details" : ""}`
              : e.changed.length
                ? `Changed the ${e.changed.map((c) => FIELD_NAMES[c] ?? c.replace(/_/g, " ")).slice(0, 4).join(", ")}${e.changed.length > 4 ? "…" : ""}`
                : "Saved without changes";
        return (
          <li key={i} className="flex gap-3 border-b border-border py-2 last:border-b-0">
            <span className="w-28 flex-none text-small text-text-3 tabular-nums">
              {formatDate(e.at, timeZone)} {formatTime(e.at, timeZone)}
            </span>
            <span className="text-cell">
              {what} <span className="text-text-3">· {who}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
