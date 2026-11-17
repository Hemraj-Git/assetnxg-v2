"use client";

import { useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { cn } from "cn";
import { formatCount } from "@/lib/table-params";
import { useReducedMotion } from "@/lib/use-media-query";

// Canvas · Chart style board, checked against the dataviz method:
// - series colours in a fixed order, never cycled: 1 blue Preventive,
//   2 amber Corrective, 3 purple Housekeeping, 4 green Inspection, 5 slate
//   Other (validated for colour-blind separation in light and dark);
// - one y-axis per chart; hairline solid gridlines; bars ≤ 24px with a 4px
//   rounded end and a 2px surface gap between stacked segments; 2px lines;
//   area fills at 10%;
// - every chart card has a Chart / Table switch and a legend that toggles
//   series (at least one stays on); the same tooltip card everywhere;
// - text uses text colours, never the series colour;
// - reduced motion: no animation.

export const SERIES = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
] as const;

export type Series = {
  key: string;
  label: string;
  /** Position in the fixed order (0–4), so a colour follows its entity. */
  color: 0 | 1 | 2 | 3 | 4;
};

type Row = Record<string, string | number>;

const AXIS_TICK = { fill: "var(--color-chart-axis)", fontSize: 12 };

// ───────────── Card: title, legend toggles, Chart / Table ─────────────

export function ChartCard({
  title,
  subtitle,
  series,
  data,
  categoryKey,
  categoryLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Omit for a single-series chart (the title names it; no legend). */
  series: Series[];
  data: Row[];
  categoryKey: string;
  categoryLabel: string;
  /** The chart, given the series the person left on. */
  children: (visible: Series[]) => ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = series.filter((s) => !hidden.includes(s.key));

  function toggle(key: string) {
    setHidden((h) => {
      if (h.includes(key)) return h.filter((k) => k !== key);
      // At least one series stays on.
      return series.length - h.length > 1 ? [...h, key] : h;
    });
  }

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-surface p-5 max-sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-card">{title}</h2>
          {subtitle && <span className="text-small text-text-3">{subtitle}</span>}
        </div>
        <div role="group" aria-label={`${title}: view`} className="inline-flex flex-none gap-0.5 rounded-sm border border-border bg-sunken p-0.5">
          {(
            [
              ["chart", "Chart", BarChart3],
              ["table", "Table", Table2],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-xs px-2 text-[12.5px] text-text-2",
                view === value && "bg-surface font-medium text-text shadow-1 dark:bg-raised",
              )}
            >
              <Icon aria-hidden className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {series.length > 1 && view === "chart" && (
        <div role="group" aria-label={`${title}: series`} className="flex flex-wrap gap-x-1 gap-y-1">
          {series.map((s) => {
            const on = !hidden.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.key)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-xs px-2 text-[12.5px] hover:bg-sunken",
                  on ? "text-text" : "text-text-3 line-through",
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-[2px]"
                  style={{ background: on ? SERIES[s.color] : "var(--color-border)" }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {view === "chart" ? (
        <div className="h-[240px] min-w-0">{children(visible)}</div>
      ) : (
        <ChartTable data={data} categoryKey={categoryKey} categoryLabel={categoryLabel} series={series} />
      )}
    </section>
  );
}

function ChartTable({
  data,
  categoryKey,
  categoryLabel,
  series,
}: {
  data: Row[];
  categoryKey: string;
  categoryLabel: string;
  series: Series[];
}) {
  const showTotal = series.length > 1;
  return (
    <div className="max-h-[240px] overflow-auto rounded-sm border border-border">
      <table className="w-full border-separate border-spacing-0 text-cell">
        <thead>
          <tr>
            <th scope="col" className="sticky top-0 border-b border-border bg-surface px-3 py-2 text-left text-[12.5px] font-medium text-text-2">
              {categoryLabel}
            </th>
            {series.map((s) => (
              <th key={s.key} scope="col" className="sticky top-0 border-b border-border bg-surface px-3 py-2 text-right text-[12.5px] font-medium text-text-2">
                {s.label}
              </th>
            ))}
            {showTotal && (
              <th scope="col" className="sticky top-0 border-b border-border bg-surface px-3 py-2 text-right text-[12.5px] font-medium text-text-2">
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={String(row[categoryKey])}>
              <th scope="row" className="border-b border-border px-3 py-1.5 text-left font-normal">
                {row[categoryKey]}
              </th>
              {series.map((s) => (
                <td key={s.key} className="border-b border-border px-3 py-1.5 text-right tabular-nums">
                  {formatCount(Number(row[s.key] ?? 0))}
                </td>
              ))}
              {showTotal && (
                <td className="border-b border-border px-3 py-1.5 text-right font-medium tabular-nums">
                  {formatCount(series.reduce((sum, s) => sum + Number(row[s.key] ?? 0), 0))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────────── Tooltip card (one for every chart) ─────────────

type TooltipEntry = { dataKey?: unknown; value?: unknown; name?: unknown; color?: string };

function TooltipCard({
  active,
  payload,
  label,
  series,
  unit,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: unknown;
  series: Series[];
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-sm border border-border bg-raised px-3 py-2 text-[12.5px] shadow-2">
      <div className="mb-1 font-semibold text-text">{String(label ?? "")}</div>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <div key={String(p.dataKey)} className="flex items-center gap-2 text-text-2">
            <span aria-hidden className="size-2 rounded-[2px]" style={{ background: s ? SERIES[s.color] : p.color }} />
            <span className="flex-1">{s?.label ?? String(p.name ?? "")}</span>
            <span className="font-semibold text-text tabular-nums">
              {formatCount(Number(p.value ?? 0))}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ───────────── Stacked columns (work orders by type, per week) ─────────────

export function StackedColumns({
  data,
  categoryKey,
  series,
}: {
  data: Row[];
  categoryKey: string;
  series: Series[];
}) {
  const reduced = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
        <XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--color-chart-grid)" }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <Tooltip
          cursor={{ fill: "var(--color-sunken)", opacity: 0.6 }}
          content={(props) => <TooltipCard {...props} series={series} />}
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="total"
            fill={SERIES[s.color]}
            // 2px gap in the surface colour between segments.
            stroke="var(--color-surface)"
            strokeWidth={2}
            maxBarSize={24}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={!reduced}
            animationBegin={i * 40}
            animationDuration={700}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ───────────── Trend (one series over time, area wash) ─────────────

export function TrendArea({
  data,
  categoryKey,
  series,
  unit,
  domain,
}: {
  data: Row[];
  categoryKey: string;
  series: Series;
  unit?: string;
  domain?: [number, number];
}) {
  const reduced = useReducedMotion();
  const color = SERIES[series.color];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
        <XAxis dataKey={categoryKey} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--color-chart-grid)" }} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          domain={domain}
          tickFormatter={(v: number) => `${formatCount(v)}${unit ?? ""}`}
        />
        <Tooltip
          cursor={{ stroke: "var(--color-border-strong)", strokeWidth: 1 }}
          content={(props) => <TooltipCard {...props} series={[series]} unit={unit} />}
        />
        <Area
          type="monotone"
          dataKey={series.key}
          name={series.label}
          stroke={color}
          strokeWidth={2}
          fill={color}
          fillOpacity={0.1}
          activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2, fill: color }}
          dot={false}
          isAnimationActive={!reduced}
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ───────────── Horizontal bars (technician workload) ─────────────

export function HorizontalBars({
  data,
  categoryKey,
  series,
}: {
  data: Row[];
  categoryKey: string;
  series: Series;
}) {
  const reduced = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--color-chart-grid)" />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey={categoryKey}
          tick={{ ...AXIS_TICK, fill: "var(--color-text-2)" }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          cursor={{ fill: "var(--color-sunken)", opacity: 0.6 }}
          content={(props) => <TooltipCard {...props} series={[series]} />}
        />
        <Bar
          dataKey={series.key}
          name={series.label}
          fill={SERIES[series.color]}
          maxBarSize={16}
          radius={[0, 4, 4, 0]}
          isAnimationActive={!reduced}
          animationDuration={700}
        >
          <LabelList
            dataKey={series.key}
            position="right"
            className="fill-text-2 text-[12px] tabular-nums"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
