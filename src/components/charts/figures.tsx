import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "cn";
import { formatCount } from "@/lib/table-params";

// Figures: when the answer is a number, not a chart. Plain SVG and HTML, so
// they render on the server.

// ───────────── KPI tile with sparkline ─────────────

export function KpiTile({
  label,
  value,
  delta,
  trend,
}: {
  /** Sentence case, no colon: "Open service requests". */
  label: string;
  value: number;
  /** Change against a named period; `good` says whether this change is good. */
  delta?: { value: number; vs: string; good: boolean };
  /** Recent values, oldest first (about 8–12 points). */
  trend?: number[];
}) {
  const DeltaIcon = delta && delta.value < 0 ? TrendingDown : TrendingUp;
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <span className="text-small text-text-2">{label}</span>
      <div className="flex items-end justify-between gap-3">
        <span className="text-kpi font-semibold tabular-nums">{formatCount(value)}</span>
        {trend && trend.length > 1 && <Sparkline values={trend} label={`${label}, recent trend`} />}
      </div>
      {delta && (
        <span className="flex items-center gap-1.5 text-caption">
          <span
            className={cn(
              "inline-flex items-center gap-1 font-semibold tabular-nums",
              delta.good ? "text-success" : "text-danger",
            )}
          >
            <DeltaIcon aria-hidden className="size-3.5" />
            {delta.value > 0 ? "+" : delta.value < 0 ? "−" : ""}
            {formatCount(Math.abs(delta.value))}
          </span>
          <span className="text-text-3">vs {delta.vs}</span>
        </span>
      )}
    </div>
  );
}

/** 1.75px line in a quiet colour, the latest point marked in the accent. */
export function Sparkline({ values, label, width = 120, height = 32 }: { values: number[]; label: string; width?: number; height?: number }) {
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="flex-none">
      <polyline
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--color-text-3)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3} fill="var(--color-chart-1)" stroke="var(--color-surface)" strokeWidth={1.5} />
    </svg>
  );
}

// ───────────── Segmented bar: one whole split into parts ─────────────

export type Part = {
  label: string;
  value: number;
  tone: "success" | "warning" | "neutral" | "danger" | "info";
  icon: LucideIcon;
};

const TONE_FILL: Record<Part["tone"], string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  neutral: "var(--color-neutral)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
};

const TONE_TEXT: Record<Part["tone"], string> = {
  success: "text-success",
  warning: "text-warning",
  neutral: "text-neutral",
  danger: "text-danger",
  info: "text-info",
};

/** Asset status and similar: status colours, each part named with an icon,
 *  so colour is never the only cue. The legend carries the numbers. */
export function SegmentedBar({ parts, label }: { parts: Part[]; label: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={`${label}: ${parts.map((p) => `${p.label} ${formatCount(p.value)}`).join(", ")}`}
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-xs"
      >
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span key={p.label} style={{ flexGrow: p.value, background: TONE_FILL[p.tone] }} className="h-full min-w-1 first:rounded-l-xs last:rounded-r-xs" />
          ))}
      </div>
      <ul className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 gap-y-1.5 text-[13px]">
        {parts.map((p) => {
          const Icon = p.icon;
          return (
            <li key={p.label} className="contents">
              <Icon aria-hidden className={cn("size-4", TONE_TEXT[p.tone])} />
              <span className="text-text">{p.label}</span>
              <span className="text-right font-semibold tabular-nums">{formatCount(p.value)}</span>
              <span className="w-10 text-right text-text-3 tabular-nums">{pct(p.value)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ───────────── Meter: one ratio against a target ─────────────

/** PM compliance and similar. The fill says how it stands: on target in the
 *  accent, below in warning, well below in danger; the track is a lighter
 *  step of the same colour. */
export function Meter({
  label,
  done,
  of,
  target = 90,
  floor = 75,
  caption,
}: {
  label: string;
  done: number;
  of: number;
  /** Percent at or above which it's on target. */
  target?: number;
  /** Percent below which it's serious. */
  floor?: number;
  caption?: string;
}) {
  const percent = of ? Math.round((done / of) * 100) : 0;
  const tone = percent >= target ? "ok" : percent >= floor ? "warn" : "bad";
  const fill = { ok: "bg-primary", warn: "bg-warning", bad: "bg-danger" }[tone];
  const track = { ok: "bg-primary-weak", warn: "bg-warning-tint", bad: "bg-danger-tint" }[tone];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-small text-text-2">{label}</span>
        <span className="text-kpi font-semibold tabular-nums">{of ? `${percent}%` : "—"}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={of ? `${percent}%, ${formatCount(done)} of ${formatCount(of)}` : "Nothing due"}
        className={cn("h-2 w-full overflow-hidden rounded-full", track)}
      >
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <span className="text-caption text-text-3 tabular-nums">
        {caption ?? `${formatCount(done)} of ${formatCount(of)} · target ${target}%`}
      </span>
    </div>
  );
}
