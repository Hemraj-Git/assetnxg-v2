import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageBody } from "@/components/shell/page-header";
import { FormMessage } from "@/components/ui/field";
import { specDisplay } from "@/lib/assets";
import { requireAdminModule } from "@/lib/auth";
import { daysBetween, formatDate, formatTime, todayIso } from "@/lib/dates";
import { currencySymbol, formatAmount } from "@/lib/money";
import { DEFAULT_MIN_STOCK, STOCK_REASON_LABEL, formatChange, stockState, stockValue } from "@/lib/spares";
import { cn } from "cn";
import { loadAssetRefs } from "../../assets/data";
import { refMaps } from "../../assets/rows";
import { loadDocumentOptions, loadDocuments } from "../../documents/data";
import { LinkedDocuments } from "../../documents/linked-documents";
import { loadMovements, loadSpare } from "../data";
import { StockChip } from "../stock-chip";
import { SparePageActions } from "./spare-page-actions";

export const metadata: Metadata = { title: "Spare" };

// A spare: details, stock with its history, storage, supplier, specs and
// documents; adjust stock, deploy as asset (02 "Spare page"). Params are read
// at request time, inside the admin layout's <Suspense>.
export default async function SparePage({ params, searchParams }: PageProps<"/admin/spares/[ref]">) {
  const [{ ref }, query] = await Promise.all([params, searchParams]);
  const { ctx, supabase } = await requireAdminModule("spares");
  const [spare, refs] = await Promise.all([loadSpare(supabase, ctx.brand.id, ref), loadAssetRefs(supabase, ctx.brand.id)]);
  if (!spare) notFound();

  const [movements, documents, library, assets] = await Promise.all([
    loadMovements(supabase, ctx.brand.id, spare.id),
    loadDocuments(supabase, ctx.brand.id, { assets: [], contracts: [] }, { spareId: spare.id }),
    loadDocumentOptions(supabase, ctx.brand.id),
    supabase.from("assets").select("id, code").eq("organization_id", ctx.brand.id),
  ]);
  const assetCode = new Map((assets.data ?? []).map((a) => [a.id, a.code]));

  const maps = refMaps(refs);
  const sub = maps.sub.get(spare.subCategoryId);
  const category = sub ? maps.category.get(sub.categoryId) : undefined;
  const room = spare.roomId ? maps.room.get(spare.roomId) : undefined;
  const building = room ? maps.building.get(room.buildingId) : undefined;
  const vendor = spare.vendorId ? maps.vendor.get(spare.vendorId) : undefined;
  const today = todayIso(ctx.timeZone);
  const state = stockState(spare.quantity, spare.minStock);
  const value = stockValue(spare.quantity, spare.unitCost);
  const warrantyDays = spare.warrantyTill ? daysBetween(today, spare.warrantyTill) : null;
  const hasHistory = movements.some((m) => m.reason !== "opening");
  const specs = (sub?.fields ?? []).map((f) => ({ k: f.label, v: specDisplay(f, spare.specValues[f.key]) || "—" }));

  return (
    <PageBody>
      {query.added === "1" && <FormMessage tone="success">{spare.code} added.</FormMessage>}
      {query.saved === "1" && <FormMessage tone="success">Saved.</FormMessage>}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="id text-[13px] text-text-2">{spare.code}</span>
            <StockChip state={state} />
          </div>
          <h1 className="text-page">{spare.name}</h1>
          <p className="text-small text-text-2">
            <Link href="/admin/spares">Spares</Link>
            <span className="text-text-3"> · {[category?.name, sub?.name].filter(Boolean).join(" › ")}</span>
          </p>
        </div>
        <SparePageActions
          spare={{ id: spare.id, code: spare.code, name: spare.name, quantity: spare.quantity, serialNo: spare.serialNo }}
          places={{
            buildings: refs.buildings.map((b) => ({ id: b.id, name: b.name })),
            rooms: refs.rooms.map((r) => ({ id: r.id, code: r.code, name: r.name, buildingId: r.buildingId })),
          }}
          today={today}
          hasHistory={hasHistory}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="In stock" value={spare.quantity.toLocaleString("en-IN")} note={state === "ok" ? "" : state === "out" ? "order more" : "at or below the minimum"} tone={state} />
        <Kpi label="Minimum" value={(spare.minStock ?? DEFAULT_MIN_STOCK).toLocaleString("en-IN")} note={spare.minStock === null ? "default (not set)" : "set on this spare"} />
        <Kpi label="Unit cost" value={spare.unitCost !== null ? `${currencySymbol()} ${formatAmount(spare.unitCost)}` : "—"} note={vendor ? `from ${vendor.name}` : "supplier not recorded"} />
        <Kpi label="Stock value" value={value !== null ? `${currencySymbol()} ${formatAmount(value)}` : "—"} note="quantity × unit cost" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Details">
            <Facts
              items={[
                { k: "Manufacturer", v: spare.manufacturer ?? "—" },
                { k: "Model", v: spare.model ?? "—" },
                { k: "Part number", v: spare.partNo ? <span className="font-mono text-[12.5px]">{spare.partNo}</span> : "—" },
                { k: "Serial number", v: spare.serialNo ? <span className="font-mono text-[12.5px]">{spare.serialNo}</span> : "—" },
                { k: "Note", v: spare.notes ?? "—" },
              ]}
            />
          </Panel>
          <Panel title="Storage and supplier">
            <Facts
              items={[
                { k: "Store", v: [room && `${room.name} · ${room.code}`, building?.name].filter(Boolean).join(" · ") || "—" },
                { k: "Shelf or bin", v: spare.storageNote ?? "—" },
                { k: "Storage and handling", v: spare.handlingNote ?? "—" },
                { k: "Supplier", v: vendor ? `${vendor.name} · ${vendor.code}` : "—" },
                { k: "Purchase date", v: formatDate(spare.purchaseDate) || "—" },
                {
                  k: "Warranty until",
                  v: spare.warrantyTill
                    ? `${formatDate(spare.warrantyTill)}${warrantyDays !== null ? (warrantyDays >= 0 ? ` · ${warrantyDays} days left` : " · ended") : ""}`
                    : "—",
                },
              ]}
            />
          </Panel>
          <Panel title={`Specifications${sub ? ` · from ${[category?.name, sub.name].filter(Boolean).join(" › ")}` : ""}`}>
            {specs.length ? <Facts items={specs} /> : <p className="text-small text-text-3">This sub-category has no extra fields.</p>}
          </Panel>
          <Panel title="Stock history">
            {movements.length === 0 ? (
              <p className="text-small text-text-3">No stock recorded yet. Use Adjust stock when some arrive.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-cell">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-text-3">
                      <th className="py-2 pr-3 font-medium">When</th>
                      <th className="py-2 pr-3 font-medium">What</th>
                      <th className="py-2 pr-3 text-right font-medium">Change</th>
                      <th className="py-2 pr-3 text-right font-medium">Stock after</th>
                      <th className="py-2 font-medium">Note · by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => {
                      const code = m.assetId ? assetCode.get(m.assetId) : undefined;
                      return (
                        <tr key={m.id} className="border-b border-border last:border-b-0">
                          <td className="py-2 pr-3 whitespace-nowrap text-text-2 tabular-nums">
                            {formatDate(m.at, ctx.timeZone)} {formatTime(m.at, ctx.timeZone)}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">{STOCK_REASON_LABEL[m.reason]}</td>
                          <td className={cn("py-2 pr-3 text-right font-medium tabular-nums", m.change < 0 ? "text-danger-ink" : "text-success-ink")}>
                            {formatChange(m.change)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{m.balanceAfter.toLocaleString("en-IN")}</td>
                          <td className="py-2 text-text-2">
                            {m.reason === "deployed" ? (
                              code ? (
                                <>
                                  Deployed as <Link href={`/admin/assets/${code}`}>{code}</Link>
                                </>
                              ) : (
                                "Deployed (the asset was later deleted)"
                              )
                            ) : (
                              (m.note ?? "")
                            )}
                            <span className="text-text-3">
                              {m.note && m.reason !== "deployed" ? " · " : m.reason === "deployed" ? " · " : ""}
                              {m.by}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title={`Documents${documents.length ? ` (${documents.length})` : ""}`}>
            <LinkedDocuments
              target={{ kind: "spare", id: spare.id, label: `${spare.code} · ${spare.name}` }}
              documents={documents}
              library={library}
            />
            <p className="text-small text-text-3">Deploying the spare gives the new asset these documents too.</p>
          </Panel>
        </div>
      </div>
    </PageBody>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "out" | "low" | "ok" }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface px-4 py-3">
      <span className="text-xs font-medium text-text-3 uppercase">{label}</span>
      <span
        className={cn(
          "text-[20px] leading-7 font-semibold tabular-nums",
          tone === "out" && "text-danger-ink",
          tone === "low" && "text-warning-ink",
        )}
      >
        {value}
      </span>
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
