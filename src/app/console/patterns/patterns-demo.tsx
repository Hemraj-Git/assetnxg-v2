"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Archive,
  Ban,
  CircleCheck,
  Eye,
  Pencil,
  QrCode,
  Trash2,
  Truck,
  UserPlus,
  Wrench,
} from "lucide-react";
import { BulkButton, DataTable } from "@/components/data-table/data-table";
import { ChartCard, HorizontalBars, StackedColumns, TrendArea, type Series } from "@/components/charts/charts";
import { KpiTile, Meter, SegmentedBar } from "@/components/charts/figures";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DetailDrawer,
  DrawerBody,
  DrawerFacts,
  DrawerFooter,
  DrawerHeader,
  DrawerSection,
} from "@/components/ui/detail-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { SelectField, TextField } from "@/components/ui/field";
import { StatusChip, type ChipTone } from "@/components/ui/status-chip";
import { formatDate } from "@/lib/dates";
import { currencySymbol, formatAmount } from "@/lib/money";
import type { TableParams } from "@/lib/table-params";
import {
  ASSET_TABLE,
  REQUESTS_BY_WEEK,
  WORKLOAD,
  WORK_BY_WEEK,
  type SampleAsset,
} from "./sample-data";

const STATUS: Record<SampleAsset["status"], { tone: ChipTone; icon: typeof CircleCheck }> = {
  Operational: { tone: "success", icon: CircleCheck },
  "Under maintenance": { tone: "warning", icon: Wrench },
  "In storage": { tone: "neutral", icon: Archive },
  Retired: { tone: "neutral", icon: Ban },
};

const TODAY = "2026-11-17";

const columns: ColumnDef<SampleAsset, unknown>[] = [
  {
    id: "id",
    header: "ID",
    meta: { priority: 0, sticky: true },
    cell: ({ row }) => <span className="id">{row.original.id}</span>,
  },
  {
    id: "name",
    header: "Name",
    meta: { priority: 0 },
    cell: ({ row }) => <span className="block max-w-[280px] truncate font-medium">{row.original.name}</span>,
  },
  {
    id: "category",
    header: "Category",
    meta: { priority: 3 },
    cell: ({ row }) => <span className="text-text-2">{row.original.category}</span>,
  },
  {
    id: "location",
    header: "Location",
    meta: { priority: 2 },
    cell: ({ row }) => <span className="text-text-2">{row.original.location}</span>,
  },
  {
    id: "status",
    header: "Status",
    meta: { priority: 1 },
    cell: ({ row }) => {
      const s = STATUS[row.original.status];
      return (
        <StatusChip tone={s.tone} icon={s.icon}>
          {row.original.status}
        </StatusChip>
      );
    },
  },
  {
    id: "lastService",
    header: "Last service",
    meta: { priority: 3 },
    cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.lastService) || "—"}</span>,
  },
  {
    id: "nextPm",
    header: "Next PM",
    meta: { priority: 1 },
    cell: ({ row }) => {
      const next = row.original.nextPm;
      const late = next !== null && next < TODAY;
      return (
        <span className={late ? "font-medium text-danger tabular-nums" : "tabular-nums"}>
          {formatDate(next) || "—"}
          {late && <span className="sr-only"> (overdue)</span>}
        </span>
      );
    },
  },
  {
    id: "cost",
    header: `Purchase cost (${currencySymbol()})`,
    meta: { priority: 4, align: "end", label: "Purchase cost" },
    cell: ({ row }) => formatAmount(row.original.cost),
  },
];

export function TableDemo({ rows, total, params }: { rows: SampleAsset[]; total: number; params: TableParams }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const index = rows.findIndex((r) => r.id === openId);
  const open = index >= 0 ? rows[index] : null;

  return (
    <>
      <DataTable
        id="patterns-assets"
        noun={{ one: "asset", many: "assets" }}
        columns={columns}
        rows={rows}
        total={total}
        getRowId={(r) => r.id}
        params={params}
        defaults={ASSET_TABLE}
        searchPlaceholder="Search assets by ID, name or place"
        openRowId={openId}
        onOpenRow={(r) => setOpenId((cur) => (cur === r.id ? null : r.id))}
        rowMenu={(r) => (
          <>
            <DropdownMenuItem onSelect={() => setOpenId(r.id)}>
              <Eye aria-hidden /> Open details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setAssignOpen(true)}>
              <Wrench aria-hidden /> Create work order
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Truck aria-hidden /> Send for repair
            </DropdownMenuItem>
            <DropdownMenuItem>
              <QrCode aria-hidden /> Print QR label
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Pencil aria-hidden /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Ban aria-hidden /> Retire asset…
            </DropdownMenuItem>
          </>
        )}
        bulkActions={(ids, clear) => (
          <>
            <BulkButton onClick={() => setAssignOpen(true)}>
              <UserPlus aria-hidden /> Assign
            </BulkButton>
            <BulkButton onClick={clear}>
              <QrCode aria-hidden /> Print QR labels
            </BulkButton>
            <span className="sr-only">{ids.length} chosen</span>
          </>
        )}
        renderCard={(r) => {
          const s = STATUS[r.status];
          return (
            <span className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <span className="id text-text-3">{r.id}</span>
              <StatusChip tone={s.tone} icon={s.icon} className="justify-self-end">
                {r.status}
              </StatusChip>
              <span className="col-span-2 text-sm font-medium">{r.name}</span>
              <span className="text-small text-text-2">{r.location}</span>
              <span className="justify-self-end text-small text-text-2 tabular-nums">
                {r.nextPm ? `PM ${formatDate(r.nextPm)}` : ""}
              </span>
            </span>
          );
        }}
      />

      <DetailDrawer open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        {open && (
          <>
            <DrawerHeader
              id={open.id}
              title={open.name}
              chips={
                <StatusChip tone={STATUS[open.status].tone} icon={STATUS[open.status].icon}>
                  {open.status}
                </StatusChip>
              }
              actions={
                <>
                  <Button onClick={() => setAssignOpen(true)}>
                    <Wrench aria-hidden /> Create work order
                  </Button>
                  <Button variant="secondary">
                    <QrCode aria-hidden /> Print QR label
                  </Button>
                </>
              }
            />
            <DrawerBody>
              <DrawerSection title="Asset">
                <DrawerFacts
                  items={[
                    { label: "Category", value: open.category },
                    { label: "Location", value: open.location },
                    { label: "Last service", value: formatDate(open.lastService) || "—" },
                    { label: "Next PM", value: formatDate(open.nextPm) || "—" },
                    { label: "Purchase cost", value: `${currencySymbol()} ${formatAmount(open.cost)}` },
                  ]}
                />
              </DrawerSection>
              <DrawerSection title="Activity">
                <p className="text-small text-text-2">The asset&apos;s timeline arrives with the assets module.</p>
              </DrawerSection>
            </DrawerBody>
            <DrawerFooter
              position={`${index + 1} of ${rows.length} on this page`}
              onPrevious={index > 0 ? () => setOpenId(rows[index - 1].id) : undefined}
              onNext={index < rows.length - 1 ? () => setOpenId(rows[index + 1].id) : undefined}
            />
          </>
        )}
      </DetailDrawer>

      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} />
    </>
  );
}

function AssignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="text-card">Assign technician</DialogTitle>
          <DialogDescription>WO-CM-2026-0118 · Compressor tripping repeatedly</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <SelectField
            label="Technician"
            name="technician"
            options={[
              { value: "rk", label: "Ravi Kumar · HVAC · 3 open jobs" },
              { value: "sd", label: "Sunita Das · Electrical · 2 open jobs" },
            ]}
            help="Sorted by skill match, then lowest workload."
          />
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <TextField label="Due date" name="due" placeholder="DD-MM-YYYY" />
            <TextField label="Due time" name="time" placeholder="16:00" />
          </div>
          <TextField label="Note for the technician" name="note" optional />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialogDemo() {
  const [assign, setAssign] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [remove, setRemove] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => setAssign(true)}>
        <UserPlus aria-hidden /> Dialog (md): Assign technician
      </Button>
      <Button variant="secondary" onClick={() => setDiscard(true)}>
        <Pencil aria-hidden /> Confirm: Discard changes
      </Button>
      <Button variant="secondary" onClick={() => setRemove(true)}>
        <Trash2 aria-hidden /> Confirm: Delete (typed)
      </Button>
      <AssignDialog open={assign} onOpenChange={setAssign} />
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title="Discard your changes?"
        description="You changed 2 fields in “Log breakdown resolution”."
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        onConfirm={() => setDiscard(false)}
      />
      <ConfirmDialog
        open={remove}
        onOpenChange={setRemove}
        title="Delete room ROM-0014?"
        description="This can't be undone. Rooms with assets or bookings can't be deleted."
        confirmLabel="Delete room"
        typeToConfirm="ROM-0014"
        onConfirm={() => setRemove(false)}
      />
    </div>
  );
}

const JOB_SERIES: Series[] = [
  { key: "preventive", label: "Preventive", color: 0 },
  { key: "corrective", label: "Corrective", color: 1 },
  { key: "housekeeping", label: "Housekeeping", color: 2 },
  { key: "inspection", label: "Inspection", color: 3 },
];

export function ChartsDemo() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <KpiTile label="Open service requests" value={38} delta={{ value: -5, vs: "last week", good: true }} trend={[44, 41, 45, 40, 41, 37, 38, 35, 38]} />
        <KpiTile label="PM due this week" value={24} delta={{ value: 3, vs: "last week", good: false }} trend={[18, 20, 19, 22, 21, 23, 21, 24]} />
        <KpiTile label="Repairs overdue from vendors" value={3} delta={{ value: 1, vs: "last week", good: false }} trend={[1, 1, 2, 2, 1, 3, 3, 3]} />
        <KpiTile label="Assets" value={1284} />
      </div>

      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <ChartCard
          title="Work orders by type, per week"
          subtitle="Last 8 weeks · all campuses"
          series={JOB_SERIES}
          data={WORK_BY_WEEK}
          categoryKey="week"
          categoryLabel="Week of"
        >
          {(visible) => <StackedColumns data={WORK_BY_WEEK} categoryKey="week" series={visible} />}
        </ChartCard>
        <ChartCard
          title="Service requests raised"
          subtitle="Per week · last 8 weeks"
          series={[{ key: "requests", label: "Requests", color: 0 }]}
          data={REQUESTS_BY_WEEK}
          categoryKey="week"
          categoryLabel="Week of"
        >
          {() => (
            <TrendArea data={REQUESTS_BY_WEEK} categoryKey="week" series={{ key: "requests", label: "Requests", color: 0 }} />
          )}
        </ChartCard>
        <ChartCard
          title="Technician workload"
          subtitle="Open jobs now"
          series={[{ key: "open", label: "Open jobs", color: 0 }]}
          data={WORKLOAD}
          categoryKey="person"
          categoryLabel="Technician"
        >
          {() => <HorizontalBars data={WORKLOAD} categoryKey="person" series={{ key: "open", label: "Open jobs", color: 0 }} />}
        </ChartCard>
        <section className="flex flex-col gap-6 rounded-md border border-border bg-surface p-5 max-sm:p-4">
          <div className="flex flex-col gap-3">
            <h2 className="text-card">Asset status</h2>
            <SegmentedBar
              label="Asset status"
              parts={[
                { label: "Operational", value: 1102, tone: "success", icon: CircleCheck },
                { label: "Under maintenance", value: 96, tone: "warning", icon: Wrench },
                { label: "In storage", value: 61, tone: "neutral", icon: Archive },
                { label: "Retired", value: 25, tone: "danger", icon: Ban },
              ]}
            />
          </div>
          <Meter label="PM done on time this month" done={41} of={47} />
        </section>
      </div>
    </div>
  );
}
