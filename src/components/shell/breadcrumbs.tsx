"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { breadcrumbsFor } from "./nav-config";

// Canvas · App header: "Operations › Work orders › Preventive". Below 768px
// only the current page shows. Reads the URL, so it sits in <Suspense>
// (Cache Components); nothing shows until the address is known.
export function Breadcrumbs() {
  return (
    <Suspense fallback={null}>
      <Crumbs />
    </Suspense>
  );
}

function Crumbs() {
  const crumbs = breadcrumbsFor(usePathname());
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 overflow-hidden">
      <ol className="flex items-center gap-1.5 text-[13.5px] whitespace-nowrap text-text-2">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              <li className={last ? "min-w-0 truncate font-medium text-text" : "max-md:hidden"}>
                {last ? (
                  <span aria-current="page">{c.label}</span>
                ) : c.href ? (
                  <Link href={c.href} className="text-text-2 no-underline hover:text-text hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  c.label
                )}
              </li>
              {!last && (
                <li aria-hidden className="max-md:hidden">
                  <ChevronRight className="size-3.5 text-text-3" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
