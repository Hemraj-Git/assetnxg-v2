"use client";

import { useCallback, useSyncExternalStore } from "react";

// A per-device preference in localStorage (theme, sidebar collapsed), read as
// an external store: no setState-in-effect, other tabs stay in sync, and the
// server snapshot keeps the first render identical on server and client.
// Organisation settings never go here (docs/context/07-lessons.md, lesson 8).

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private window or blocked storage
  }
}

export function useLocalPreference<T extends string>(
  key: string,
  parse: (raw: string | null) => T,
  serverValue: T,
): [T, (value: T) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(onChange);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        set.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );

  const value = useSyncExternalStore(
    subscribe,
    () => parse(read(key)),
    () => serverValue,
  );

  const setValue = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // blocked storage: nothing to remember, but listeners still update
      }
      notify(key);
    },
    [key],
  );

  return [value, setValue];
}
