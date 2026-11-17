"use client";

import { useCallback, useEffect } from "react";
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  resolvesToDark,
  type ThemePreference,
} from "@/lib/theme";
import { useLocalPreference } from "@/lib/use-local-preference";

const parse = (raw: string | null): ThemePreference => (isThemePreference(raw) ? raw : "system");

function storedPreference(): ThemePreference {
  try {
    return parse(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function apply(pref: ThemePreference) {
  const dark = resolvesToDark(pref, window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Light / dark / system, remembered per device. The <head> boot script has
 *  already applied it before paint; this keeps it in sync afterwards. */
export function useTheme() {
  const [preference, store] = useLocalPreference(THEME_STORAGE_KEY, parse, "system");

  // Keep the page in step with the preference (also when another tab changes
  // it), and follow the operating system while set to "system". Reads the
  // stored value, not `preference`: during hydration `preference` is still the
  // server's "system", and applying that would flash the wrong theme.
  useEffect(() => {
    const stored = storedPreference();
    apply(stored);
    if (stored !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setTheme = useCallback(
    (pref: ThemePreference) => {
      store(pref);
      apply(pref);
    },
    [store],
  );

  return { preference, setTheme };
}
