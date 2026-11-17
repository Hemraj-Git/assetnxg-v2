"use client";

import Link from "next/link";
import { Fragment } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppModule } from "@/lib/modules";
import { createItemsFor } from "./create-config";

// Canvas · Header menus › Create. Only what this client's modules allow.
// Entries whose form isn't built yet show "Soon" and can't be chosen.
export function CreateMenu({ modules }: { modules: readonly AppModule[] }) {
  const items = createItemsFor(modules);
  if (items.length === 0) return null;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Create" className="max-sm:w-8 max-sm:px-0">
          <Plus aria-hidden />
          <span className="max-sm:hidden">Create</span>
          <ChevronDown aria-hidden className="-mr-1 size-3.5 max-sm:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-[260px]">
        {items.map((item, i) => {
          const Icon = item.icon;
          const newSection = i > 0 && items[i - 1].section !== item.section;
          return (
            <Fragment key={item.label}>
              {newSection && <DropdownMenuSeparator />}
              {item.href ? (
                <DropdownMenuItem asChild>
                  <Link href={item.href} className="text-text no-underline">
                    <Icon aria-hidden className="text-text-3" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>
                  <Icon aria-hidden className="text-text-3" />
                  {item.label}
                  <span className="ml-auto text-xs text-text-3">Soon</span>
                </DropdownMenuItem>
              )}
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
