// Theme: light, dark or follow the system. A per-device preference (like
// sound), so it lives in the browser; organisation settings never do
// (docs/context/07-lessons.md, lesson 8).

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "assetnxg-theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/** Whether the dark palette applies for a preference. */
export function resolvesToDark(pref: ThemePreference, systemPrefersDark: boolean): boolean {
  return pref === "dark" || (pref === "system" && systemPrefersDark);
}

/**
 * Runs in <head> before first paint so dark-theme users never see a white
 * flash. Kept tiny and dependency-free; mirrors resolvesToDark().
 */
export const themeBootScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
