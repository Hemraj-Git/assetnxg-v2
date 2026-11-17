"use client";

import { createContext, useContext } from "react";

// Lets navigation rendered anywhere in the shell close the phone menu after a
// tap (the same nav renders in the sidebar and in the phone sheet).
export const ShellNavContext = createContext<{ closeNav: () => void }>({ closeNav: () => {} });

export function useShellNav() {
  return useContext(ShellNavContext);
}
