import { describe, expect, it } from "vitest";
import { isThemePreference, resolvesToDark, themeBootScript } from "./theme";

describe("resolvesToDark", () => {
  it("follows an explicit choice regardless of the system", () => {
    expect(resolvesToDark("dark", false)).toBe(true);
    expect(resolvesToDark("light", true)).toBe(false);
  });

  it("follows the system when set to system", () => {
    expect(resolvesToDark("system", true)).toBe(true);
    expect(resolvesToDark("system", false)).toBe(false);
  });
});

describe("isThemePreference", () => {
  it("accepts only the three preferences", () => {
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("blue")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});

describe("themeBootScript", () => {
  function run(stored: string | null, systemDark: boolean) {
    const classes = new Set<string>();
    const sandbox = {
      localStorage: { getItem: () => stored },
      window: { matchMedia: () => ({ matches: systemDark }) },
      document: {
        documentElement: {
          classList: {
            toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
          },
        },
      },
    };
    new Function("localStorage", "window", "document", themeBootScript)(
      sandbox.localStorage,
      sandbox.window,
      sandbox.document,
    );
    return classes.has("dark");
  }

  it("matches resolvesToDark for every stored value", () => {
    expect(run("dark", false)).toBe(true);
    expect(run("light", true)).toBe(false);
    expect(run("system", true)).toBe(true);
    expect(run(null, true)).toBe(true);
    expect(run("garbage", false)).toBe(false);
  });

  it("never throws when storage is blocked", () => {
    const throwing = { getItem: () => { throw new Error("blocked"); } };
    expect(() =>
      new Function("localStorage", "window", "document", themeBootScript)(throwing, {}, {}),
    ).not.toThrow();
  });
});
