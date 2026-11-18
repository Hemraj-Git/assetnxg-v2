"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardCheck, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { TableMessage } from "@/components/data-table/table-message";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDate } from "@/lib/dates";
import { REPEAT_LABEL, type ChecklistKind, type RepeatInterval } from "@/lib/templates";
import { cn } from "cn";

type Row = {
  id: string;
  title: string;
  description: string | null;
  repeats: RepeatInterval;
  items: number;
  usedBy: string[];
  updatedAt: string;
};

export function TemplatesList({ kind, rows, timeZone }: { kind: ChecklistKind; rows: Row[]; timeZone: string }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((r) => !needle || `${r.title} ${r.description ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base", numeric: true }));
  const Icon = kind === "pm" ? ShieldCheck : ClipboardCheck;

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface">
        <TableMessage
          icon={Icon}
          actions={
            <Button asChild>
              <Link href={`/admin/templates/new?kind=${kind}`}>New template</Link>
            </Button>
          }
        >
          {kind === "pm"
            ? "No PM templates yet. A template is the checklist a technician follows on a preventive job, e.g. “Split AC monthly service”."
            : "No inspection templates yet. A template is the checklist an inspector follows, e.g. “Fire extinguisher monthly check”."}
        </TableMessage>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="relative w-full max-w-[300px]">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-3" />
        <input
          aria-label="Search templates"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search templates"
          className={cn(inputClass, "h-8 pl-8 text-[13px]")}
        />
      </span>
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-cell">
          <thead>
            <tr>
              {["Template", "Repeats", "Items", "Used by", "Last edited"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    "border-b border-border px-4 py-2.5 text-left text-[12.5px] font-medium text-text-2",
                    h === "Items" && "text-right",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-small text-text-3">
                  No templates match “{q}”.
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={r.id} className="hover:bg-sunken">
                  <th scope="row" className="border-b border-border px-4 py-2.5 text-left font-normal">
                    <Link href={`/admin/templates/${r.id}`} className="flex flex-col text-text no-underline hover:underline">
                      <span className="font-medium">{r.title}</span>
                      {r.description && <span className="text-small text-text-3">{r.description}</span>}
                    </Link>
                  </th>
                  <td className="border-b border-border px-4 py-2.5">
                    <StatusChip tone={kind === "pm" ? "info" : "neutral"} icon={RefreshCw}>
                      {REPEAT_LABEL[r.repeats]}
                    </StatusChip>
                  </td>
                  <td className="border-b border-border px-4 py-2.5 text-right tabular-nums">{r.items}</td>
                  <td className="border-b border-border px-4 py-2.5 text-text-2">
                    {r.usedBy.length === 0 ? (
                      <span className="text-text-3">Not used yet</span>
                    ) : (
                      <span title={r.usedBy.join("\n")}>
                        {r.usedBy.length} {r.usedBy.length === 1 ? "sub-category" : "sub-categories"}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-border px-4 py-2.5 text-text-2 tabular-nums">{formatDate(r.updatedAt, timeZone)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
