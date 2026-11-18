"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { formatCount } from "@/lib/table-params";
import { cn } from "cn";
import type { AssetOption } from "./data";

const SHOW_MAX = 300;

export type AssetPickerRefs = {
  assets: AssetOption[];
  categories: { id: string; name: string }[];
  buildings: { id: string; name: string }[];
};

/** Choose many assets: search, filter by category and building, select all
 *  shown. Sends each chosen id as a hidden `name` field. */
export function AssetPicker({
  refs,
  selected,
  onChange,
  legend,
  name = "asset_ids",
}: {
  refs: AssetPickerRefs;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  legend: string;
  name?: string;
}) {
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [buildingId, setBuildingId] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return refs.assets.filter(
      (a) =>
        (!a.retired || selected.has(a.id)) &&
        (!categoryId || a.categoryId === categoryId) &&
        (!buildingId || a.buildingId === buildingId) &&
        (!needle || `${a.code} ${a.name} ${a.category} ${a.location}`.toLowerCase().includes(needle)),
    );
  }, [refs.assets, q, categoryId, buildingId, selected]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[13px] leading-[18px] font-medium">
        {legend} <span className="font-normal text-text-3">· {formatCount(selected.size)} chosen</span>
      </legend>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative min-w-48 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-3" />
          <input
            aria-label="Search assets"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID, name or place"
            className={cn(inputClass, "h-8 pl-8 text-[13px]")}
          />
        </span>
        <select
          aria-label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={cn(inputClass, "h-8 w-auto max-w-40 cursor-pointer pr-8 text-[13px]")}
        >
          <option value="">All categories</option>
          {refs.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Building"
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
          className={cn(inputClass, "h-8 w-auto max-w-40 cursor-pointer pr-8 text-[13px]")}
        >
          <option value="">All buildings</option>
          {refs.buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-small">
        <span className="text-text-3">
          {formatCount(shown.length)} shown{shown.length > SHOW_MAX ? ` (first ${SHOW_MAX}; search to narrow)` : ""}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={shown.length === 0}
          onClick={() => onChange(new Set([...selected, ...shown.map((a) => a.id)]))}
        >
          Select all shown
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={selected.size === 0} onClick={() => onChange(new Set())}>
          Clear
        </Button>
      </div>
      <ul className="max-h-64 overflow-y-auto rounded-sm border border-border">
        {shown.length === 0 ? (
          <li className="px-3 py-4 text-small text-text-3">
            {refs.assets.length === 0 ? "No assets yet. Add assets first." : "No assets match."}
          </li>
        ) : (
          shown.slice(0, SHOW_MAX).map((a) => (
            <li key={a.id} className="border-b border-border last:border-b-0">
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-sunken has-checked:bg-primary-weak">
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggle(a.id)}
                  className="size-4 flex-none accent-(--color-primary)"
                />
                <span className="id w-20 flex-none text-text-2">{a.code}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-cell font-medium">
                    {a.name}
                    {a.retired && <span className="font-normal text-text-3"> (retired)</span>}
                  </span>
                  <span className="truncate text-small text-text-3">{[a.category, a.location].filter(Boolean).join(" · ")}</span>
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
    </fieldset>
  );
}
