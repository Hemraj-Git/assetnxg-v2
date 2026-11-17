import type { ReactNode } from "react";

// Canvas · App shell: one page title under the header, actions on the right.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-page">{title}</h1>
        {description && <p className="text-small text-text-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Page body: gutter, 24px top, 16px between blocks, max 1600px. */
export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-[1600px] flex-col gap-4 px-(--gutter) pt-6 pb-8 max-md:gap-3 max-md:px-4 max-md:pt-4">
      {children}
    </div>
  );
}

/** Placeholder for a section that a later build phase delivers. */
export function ComingInPhase({ phase, what }: { phase: number; what: string }) {
  return (
    <section className="flex max-w-2xl flex-col gap-2 rounded-md border border-border bg-surface p-6">
      <span className="eyebrow">Phase {phase}</span>
      <h2 className="text-card">{what} arrives in phase {phase}</h2>
      <p className="text-small text-text-2">
        The navigation and page frame are in place. The screens for this section are built with
        the rest of phase {phase}.
      </p>
    </section>
  );
}
