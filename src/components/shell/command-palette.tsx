"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Monitor, Moon, Search, Sun } from "lucide-react";
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import type { AppModule } from "@/lib/modules";
import type { ThemePreference } from "@/lib/theme";
import { destinationsFor } from "./nav-config";
import { useTheme } from "./use-theme";

// Canvas · Header menus › Command palette (Ctrl/⌘ K). For now it finds this
// client's pages and runs the theme commands; records (assets, rooms, work
// orders, people, vendors) join the list as their modules are built.

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "Theme same as this device", icon: Monitor },
];

const noSubscribe = () => () => {};

/** "⌘" on Apple devices, "Ctrl" elsewhere (and on the server). */
function useModKey(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

export function CommandPalette({ modules }: { modules: readonly AppModule[] }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const mod = useModKey();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const pages = destinationsFor(modules);

  // Ctrl/⌘ K anywhere opens (or closes) it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string, newTab = false) {
    setOpen(false);
    if (newTab) window.open(href, "_blank", "noopener");
    else router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search or run a command"
        aria-keyshortcuts="Control+K Meta+K"
        className="flex h-[34px] w-[clamp(200px,24vw,340px)] items-center gap-2 rounded-sm border border-border bg-bg pr-1.5 pl-2.5 text-[13.5px] text-text-3 transition-colors duration-(--dur-1) hover:border-border-strong max-lg:w-10 max-lg:justify-center max-lg:p-0"
      >
        <Search aria-hidden className="size-4 flex-none" />
        <span className="flex-1 truncate text-left max-lg:hidden">Search pages and commands…</span>
        <kbd className="kbd max-lg:hidden">{mod} K</kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search and commands"
        description="Find a page or run a command. Use the arrow keys to move and Enter to open."
      >
        <Command
          loop
          value={selected}
          onValueChange={setSelected}
          onKeyDown={(e) => {
            // Ctrl/⌘ Enter opens the highlighted page in a new tab.
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              const page = pages.find((p) => p.href === selected);
              if (page) {
                e.preventDefault();
                go(page.href, true);
              }
            }
          }}
        >
          <CommandInput
            placeholder="Go to a page or run a command"
            trailing={<kbd className="kbd">Esc</kbd>}
          />
          <CommandList>
            <CommandEmpty>Nothing matches. Try another word.</CommandEmpty>

            <CommandGroup heading="Pages">
              {pages.map((page) => {
                const Icon = page.icon;
                return (
                  <CommandItem
                    key={page.href}
                    value={page.href}
                    keywords={[page.label, page.trail]}
                    onSelect={() => go(page.href)}
                  >
                    <Icon aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      {page.label} <span className="text-text-3">· {page.trail}</span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandGroup heading="Commands">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <CommandItem
                  key={value}
                  value={`theme:${value}`}
                  keywords={[label, "theme", "appearance"]}
                  onSelect={() => {
                    setTheme(value);
                    setOpen(false);
                  }}
                >
                  <Icon aria-hidden />
                  <span className="flex-1">{label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>

          <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface px-4 py-2.5 text-xs text-text-3">
            <span className="flex items-center gap-1">
              <kbd className="kbd">↑</kbd>
              <kbd className="kbd">↓</kbd> move
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd">Enter</kbd> open
            </span>
            <CommandShortcut className="ml-0 max-sm:hidden">
              <kbd className="kbd">{mod} Enter</kbd> new tab
            </CommandShortcut>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
