import { describe, expect, it } from "vitest";
import { ALL_MODULES } from "@/lib/modules";
import { NAV, breadcrumbsFor, destinationsFor, findNavLeaf, isActive, navForModules, navSectionParams } from "./nav-config";

function labels(groups: ReturnType<typeof navForModules>): string[] {
  return groups.flatMap((g) => g.items.flatMap((i) => [i.label, ...(i.children ?? []).map((c) => c.label)]));
}

describe("navForModules", () => {
  it("shows everything when every module is on", () => {
    expect(labels(navForModules(ALL_MODULES))).toEqual(labels(NAV));
  });

  it("keeps core pages with no modules, and drops empty groups' module pages", () => {
    const l = labels(navForModules([]));
    expect(l).toEqual(expect.arrayContaining(["Dashboard", "Reports", "Assets", "QR codes", "Locations", "People & departments"]));
    expect(l).not.toEqual(expect.arrayContaining(["Work orders"]));
    expect(l).not.toContain("Service requests");
    expect(l).not.toContain("Spares & inventory");
    expect(l).not.toContain("Checklist templates");
  });

  it("shows only the work-order views the client has", () => {
    const l = labels(navForModules(["housekeeping"]));
    expect(l).toContain("Work orders");
    expect(l).toContain("Housekeeping");
    expect(l).not.toContain("Preventive");
    expect(l).not.toContain("Checklist templates");
  });

  it("shows checklist templates for inspections alone", () => {
    expect(labels(navForModules(["inspections"]))).toContain("Checklist templates");
  });

  it("removes a group that ends up empty", () => {
    const onlyOps = [{ label: "Ops", items: NAV[1].items }];
    expect(navForModules([], onlyOps)).toEqual([]);
  });
});

describe("isActive", () => {
  it("lights the dashboard only on /admin itself", () => {
    expect(isActive("/admin", "/admin")).toBe(true);
    expect(isActive("/admin", "/admin/")).toBe(true);
    expect(isActive("/admin", "/admin/assets")).toBe(false);
  });

  it("lights a section on its own page and pages under it", () => {
    expect(isActive("/admin/assets", "/admin/assets")).toBe(true);
    expect(isActive("/admin/assets", "/admin/assets/AST-0013")).toBe(true);
    expect(isActive("/admin/assets", "/admin/assets?status=open")).toBe(true);
  });

  it("does not confuse sections that share a prefix", () => {
    expect(isActive("/admin/work-orders", "/admin/work-orders-archive")).toBe(false);
  });
});

describe("breadcrumbsFor", () => {
  it("gives Group › Item for a section", () => {
    expect(breadcrumbsFor("/admin/assets")).toEqual([
      { label: "Assets" },
      { label: "Assets" },
    ]);
  });

  it("gives Group › Work orders › View for a work-order view, linking the parent", () => {
    expect(breadcrumbsFor("/admin/work-orders/preventive")).toEqual([
      { label: "Operations" },
      { label: "Work orders", href: "/admin/work-orders" },
      { label: "Preventive" },
    ]);
  });

  it("is empty for unknown pages", () => {
    expect(breadcrumbsFor("/admin/nope")).toEqual([]);
  });
});

describe("findNavLeaf and navSectionParams", () => {
  it("finds exact entries only", () => {
    expect(findNavLeaf("/admin/vendors")?.label).toBe("Vendors");
    expect(findNavLeaf("/admin/vendors/VND-0001")).toBeNull();
  });

  it("lists every nav page except the dashboard, with unique paths", () => {
    const params = navSectionParams();
    const paths = params.map((p) => p.section.join("/"));
    expect(paths).toContain("work-orders/preventive");
    expect(paths).not.toContain("");
    expect(paths).not.toContain("people"); // has its own route
    expect(paths).not.toContain("locations");
    expect(paths).not.toContain("categories");
    expect(paths).not.toContain("vendors");
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("uses plain words for every label (no system words)", () => {
    const labels = NAV.flatMap((g) => g.items.flatMap((i) => [i.label, ...(i.children ?? []).map((c) => c.label)]));
    for (const label of labels) {
      expect(label).not.toMatch(/[_]|^[a-z]/);
    }
  });
});

describe("destinationsFor", () => {
  it("lists only the pages this client has, with where they sit", () => {
    const list = destinationsFor(["housekeeping"]);
    const byHref = Object.fromEntries(list.map((d) => [d.href, d.trail]));
    expect(byHref["/admin/work-orders/housekeeping"]).toBe("Operations › Work orders");
    expect(byHref["/admin/work-orders"]).toBe("Operations");
    expect(byHref["/admin/work-orders/preventive"]).toBeUndefined();
    expect(byHref["/admin/inspections"]).toBeUndefined();
    expect(byHref["/admin/assets"]).toBe("Assets");
  });

  it("with every module, has one entry per nav page", () => {
    const pages = NAV.flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])]));
    expect(destinationsFor(ALL_MODULES)).toHaveLength(pages.length);
  });
});
