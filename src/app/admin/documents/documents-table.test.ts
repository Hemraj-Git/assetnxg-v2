import { describe, expect, it } from "vitest";
import type { DocumentRow } from "./data";
import { applyDocumentFilters, documentSearchText, documentSortValue, linksText, parseDocumentFilters } from "./documents-table";

const row = (over: Partial<DocumentRow>): DocumentRow => ({
  id: "1",
  code: "DOC-2026-0001",
  title: "Invoice 4471",
  docType: "invoice",
  fileName: "inv-4471.pdf",
  fileType: "application/pdf",
  fileSize: 1000,
  assetIds: [],
  contractIds: [],
  assets: [],
  contracts: [],
  uploadedBy: "Asha Rao",
  createdAt: "2026-11-18T08:00:00Z",
  ...over,
});

describe("documents table", () => {
  it("parses filters, ignoring junk", () => {
    expect(parseDocumentFilters({ type: "warranty", links: "none" })).toEqual({ type: "warranty", links: "none" });
    expect(parseDocumentFilters({ type: "nope", links: "x" })).toEqual({ type: null, links: null });
  });

  it("filters by type and by not linked", () => {
    const rows = [
      row({ id: "a", docType: "invoice", assetIds: ["x"] }),
      row({ id: "b", docType: "warranty" }),
      row({ id: "c", docType: "invoice" }),
    ];
    expect(applyDocumentFilters(rows, { type: "invoice", links: null }).map((r) => r.id)).toEqual(["a", "c"]);
    expect(applyDocumentFilters(rows, { type: null, links: "none" }).map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("searches linked assets and the file name", () => {
    const text = documentSearchText(row({ assets: [{ id: "x", code: "AST-0013", name: "Split AC" }] }));
    expect(text).toContain("AST-0013 Split AC");
    expect(text).toContain("inv-4471.pdf");
  });

  it("sorts by links and size", () => {
    expect(documentSortValue(row({ assetIds: ["a", "b"], contractIds: ["c"] }), "links")).toBe(3);
    expect(documentSortValue(row({}), "size")).toBe(1000);
  });

  it("describes links", () => {
    expect(linksText({ assetIds: [], contractIds: [] })).toBe("Not linked");
    expect(linksText({ assetIds: ["a"], contractIds: ["b", "c"] })).toBe("1 asset, 2 contracts");
  });
});
