import { describe, expect, it } from "vitest";
import { checkFile, fileKind, fileTypeOf, formatFileSize, isDocumentPath, titleFromFileName } from "./documents";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("fileTypeOf", () => {
  it("trusts an accepted type the browser gives", () => {
    expect(fileTypeOf({ name: "a.pdf", type: "application/pdf" })).toBe("application/pdf");
  });
  it("falls back to the extension when the browser doesn't know", () => {
    expect(fileTypeOf({ name: "Manual.DOCX", type: "" })).toBe(DOCX);
    expect(fileTypeOf({ name: "scan.jpeg", type: "application/octet-stream" })).toBe("image/jpeg");
  });
  it("refuses other types, even with an accepted extension", () => {
    expect(fileTypeOf({ name: "x.pdf", type: "text/html" })).toBe("");
    expect(fileTypeOf({ name: "sheet.xlsx", type: "" })).toBe("");
    expect(fileTypeOf({ name: "logo.svg", type: "image/svg+xml" })).toBe("");
  });
});

describe("checkFile", () => {
  it("accepts a normal PDF", () => {
    expect(checkFile({ name: "invoice.pdf", type: "application/pdf", size: 120_000 })).toBeNull();
  });
  it("gives plain reasons", () => {
    expect(checkFile({ name: "a.exe", type: "application/x-msdownload", size: 10 })).toMatch(/PDF, a photo/);
    expect(checkFile({ name: "a.pdf", type: "application/pdf", size: 0 })).toBe("That file is empty.");
    expect(checkFile({ name: "a.pdf", type: "application/pdf", size: 30 * 1024 * 1024 })).toBe(
      "That file is 30.0 MB. Files can be up to 25 MB.",
    );
    expect(checkFile({ name: `${"x".repeat(201)}.pdf`, type: "application/pdf", size: 5 })).toMatch(/shorter/);
  });
  it("allows exactly 25 MB", () => {
    expect(checkFile({ name: "a.pdf", type: "application/pdf", size: 25 * 1024 * 1024 })).toBeNull();
  });
});

describe("titleFromFileName", () => {
  it("drops the extension and separators", () => {
    expect(titleFromFileName("AMC_agreement-2026.pdf")).toBe("AMC agreement 2026");
    expect(titleFromFileName("  plain  .png")).toBe("plain");
  });
});

describe("formatFileSize / fileKind", () => {
  it("formats sizes", () => {
    expect(formatFileSize(900)).toBe("900 B");
    expect(formatFileSize(482_133)).toBe("471 KB");
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });
  it("names kinds", () => {
    expect(fileKind("application/pdf")).toBe("PDF");
    expect(fileKind("image/webp")).toBe("Image");
    expect(fileKind(DOCX)).toBe("Word");
  });
});

describe("isDocumentPath", () => {
  const org = "11111111-2222-3333-4444-555555555555";
  const file = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  it("accepts this client's folder only", () => {
    expect(isDocumentPath(`${org}/${file}.pdf`, org)).toBe(true);
    expect(isDocumentPath(`99999999-2222-3333-4444-555555555555/${file}.pdf`, org)).toBe(false);
  });
  it("refuses other shapes", () => {
    expect(isDocumentPath(`${org}/../${file}.pdf`, org)).toBe(false);
    expect(isDocumentPath(`${org}/${file}.exe`, org)).toBe(false);
    expect(isDocumentPath(`${org}/sub/${file}.pdf`, org)).toBe(false);
  });
});
