import { describe, expect, it } from "vitest";
import { clientOrigin, isConsoleHost, isValidOrgSlug, orgSlugFromHost } from "./org-slug";

describe("console host", () => {
  it("recognises the console and never treats it as a client", () => {
    expect(isConsoleHost("console.assetnxg.app")).toBe(true);
    expect(isConsoleHost("console.localhost:3000")).toBe(true);
    expect(isConsoleHost("soms.assetnxg.app")).toBe(false);
    expect(isConsoleHost("console.assetnxg.app.evil.com")).toBe(false);
    expect(orgSlugFromHost("console.assetnxg.app")).toBeNull();
    expect(isValidOrgSlug("console")).toBe(false);
  });

  it("builds a client's address from the console's", () => {
    expect(clientOrigin("console.localhost:3000", "pms", "http")).toBe("http://pms.localhost:3000");
    expect(clientOrigin("console.assetnxg.app", "pms", "https")).toBe("https://pms.assetnxg.app");
    expect(() => clientOrigin("soms.assetnxg.app", "pms", "https")).toThrow();
    expect(() => clientOrigin("console.assetnxg.app", "www", "https")).toThrow();
  });
});

describe("orgSlugFromHost", () => {
  it.each([
    ["soms.assetnxg.app", "soms"],
    ["pms.assetnxg.app", "pms"],
    ["SOMS.AssetNXG.app", "soms"],
    ["soms.assetnxg.app:443", "soms"],
    ["soms.assetnxg.app.", "soms"],
    ["soms.localhost:3000", "soms"],
    ["test-org-2.localhost", "test-org-2"],
  ])("%s → %s", (host, slug) => {
    expect(orgSlugFromHost(host)).toBe(slug);
  });

  it.each([
    ["localhost:3000"],
    ["assetnxg.app"],
    ["www.assetnxg.app"],
    ["admin.assetnxg.app"],
    ["a.b.assetnxg.app"],
    ["assetnxg-v2-git-main.vercel.app"],
    ["soms.assetnxg.app.evil.com"],
    ["evilassetnxg.app"],
    ["-bad.assetnxg.app"],
    [""],
    [null],
    [undefined],
  ])("%s → null", (host) => {
    expect(orgSlugFromHost(host)).toBeNull();
  });
});

describe("isValidOrgSlug", () => {
  it("accepts normal slugs and refuses reserved or malformed ones", () => {
    expect(isValidOrgSlug("soms")).toBe(true);
    expect(isValidOrgSlug("www")).toBe(false);
    expect(isValidOrgSlug("Has Space")).toBe(false);
    expect(isValidOrgSlug(undefined)).toBe(false);
  });
});
