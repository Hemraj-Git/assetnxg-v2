import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

// Canvas · Data table › States: empty (no data yet), empty because of
// filters, and error. One shape: icon tile, one sentence, actions.

export function TableMessage({
  icon: Icon,
  tone = "neutral",
  children,
  actions,
  meta,
}: {
  icon: LucideIcon;
  tone?: "neutral" | "danger";
  /** One sentence that says what happened and what to do. */
  children: ReactNode;
  actions?: ReactNode;
  /** Small print after the actions (e.g. "Error 503 · 10:42:18"). */
  meta?: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className="flex min-h-[232px] flex-col items-center justify-center gap-3 px-6 py-7 text-center"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-10 items-center justify-center rounded-md border",
          tone === "danger"
            ? "border-danger/30 bg-danger-tint text-danger"
            : "border-border bg-surface text-text-3",
        )}
      >
        <Icon className="size-5" />
      </span>
      <p className="max-w-md text-sm text-text-2">{children}</p>
      {(actions || meta) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions}
          {meta && <span className="text-caption text-text-3">{meta}</span>}
        </div>
      )}
    </div>
  );
}

/** Loading rows that keep the table's shape (Suspense fallback for lists). */
export function DataTableSkeleton({ columns = 5, rows = 6 }: { columns?: number; rows?: number }) {
  const widths = [72, 180, 120, 86, 64, 140, 100];
  return (
    <div aria-busy="true" aria-label="Loading" className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="flex h-12 items-center gap-2 border-b border-border px-3">
        <span className="block h-8 w-[280px] max-w-full animate-pulse rounded-sm bg-skel" />
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="h-9 border-b border-border bg-sunken">
            {Array.from({ length: columns }, (_, c) => (
              <th key={c} className="px-3">
                <span className="block h-3 w-16 animate-pulse rounded-xs bg-skel" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} className="h-11 border-b border-border last:border-b-0">
              {Array.from({ length: columns }, (_, c) => (
                <td key={c} className="px-3">
                  <span
                    className="block h-3.5 animate-pulse rounded-xs bg-skel"
                    style={{ width: widths[(c + r) % widths.length] }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
