import { Suspense, type ReactNode } from "react";
import { getBrand, isConsoleRequest } from "@/lib/auth";
import { initials } from "@/lib/initials";

// Canvas · Sign-in: two halves. Left, the client's brand leads (logo, name,
// "Facility management · AssetNXG"); right, the card. Below 768px the brand
// becomes a top bar. On the console's address the brand is AssetNXG itself.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-bg md:grid-cols-2">
      <aside className="flex items-center justify-between gap-6 border-b border-border bg-surface px-4 py-5 md:flex-col md:items-start md:border-r md:border-b-0 md:p-[clamp(24px,4vw,56px)]">
        <Suspense fallback={<span aria-hidden className="block h-14 w-56 animate-pulse rounded-sm bg-skel" />}>
          <BrandSide />
        </Suspense>
      </aside>
      <main id="main" className="flex items-start justify-center px-4 py-[clamp(24px,4vw,56px)] md:items-center">
        <div className="flex w-full max-w-[400px] flex-col gap-5">
          {children}
          <p className="mt-2 flex flex-wrap gap-3 text-caption text-text-3">
            <span>Powered by AssetNXG</span>
            <span>English (India)</span>
          </p>
        </div>
      </main>
    </div>
  );
}

function PoweredMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1" y="1" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="5" y="5" width="8" height="8" rx="1.5" fill="currentColor" opacity=".55" />
    </svg>
  );
}

async function BrandSide() {
  if (await isConsoleRequest()) {
    return (
      <div className="flex flex-col gap-2.5">
        <span className="text-[22px] font-semibold">AssetNXG Console</span>
        <span className="hidden items-center gap-1.5 text-xs text-text-3 md:flex">
          <PoweredMark /> For the AssetNXG team
        </span>
      </div>
    );
  }

  const brand = await getBrand();
  if (!brand) {
    return <span className="text-lg font-semibold">AssetNXG</span>;
  }

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-3.5">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- client logos are org data in Supabase Storage
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="max-h-14 max-w-[260px] object-contain dark:rounded-sm dark:bg-white dark:px-2 dark:py-1"
            />
          ) : (
            <>
              <span
                aria-hidden
                className="inline-flex size-12 flex-none items-center justify-center rounded-md bg-text text-base font-semibold text-surface"
              >
                {initials(brand.name)}
              </span>
              <span className="text-lg leading-snug font-semibold">{brand.name}</span>
            </>
          )}
        </div>
        <span className="hidden items-center gap-1.5 text-xs text-text-3 md:flex">
          <PoweredMark /> Facility management · AssetNXG
        </span>
      </div>
      <p className="hidden max-w-[360px] text-small text-text-2 md:block">
        For staff of {brand.name}. Technicians and housekeeping use the field app on their phones.
      </p>
    </>
  );
}
