"use client";

import { useCallback, useSyncExternalStore } from "react";

/** True while the CSS media query matches. `false` on the server and in the
 *  first render, so markup that depends on it should be client-only (e.g.
 *  inside something opened by the person). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Prefers reduced motion: charts and count-ups switch their animation off. */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
