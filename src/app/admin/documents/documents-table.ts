import { DOC_TYPES, DOC_TYPE_LABEL, type DocumentType } from "@/lib/documents";
import type { TableDefaults } from "@/lib/table-params";
import type { DocumentRow } from "./data";

// The documents library list: search, sort and filters. Shared by the server
// page and the table.

export const DOCUMENTS_TABLE: TableDefaults = {
  sortable: ["code", "title", "type", "links", "size", "uploaded"],
  sort: "uploaded",
  dir: "desc",
};

export function documentSearchText(d: DocumentRow): string {
  return [
    d.code,
    d.title,
    d.fileName,
    DOC_TYPE_LABEL[d.docType],
    d.uploadedBy,
    ...d.assets.map((a) => `${a.code} ${a.name}`),
    ...d.contracts.map((c) => `${c.code} ${c.name}`),
  ].join(" ");
}

export function documentSortValue(d: DocumentRow, column: string): string | number | null {
  switch (column) {
    case "code":
      return d.code;
    case "title":
      return d.title;
    case "type":
      return DOC_TYPE_LABEL[d.docType];
    case "links":
      return d.assetIds.length + d.contractIds.length;
    case "size":
      return d.fileSize;
    case "uploaded":
      return d.createdAt;
    default:
      return null;
  }
}

export type DocumentFilters = { type: DocumentType | null; links: "none" | null };

export function parseDocumentFilters(query: Record<string, string | string[] | undefined>): DocumentFilters {
  const t = query.type;
  return {
    type: typeof t === "string" && (DOC_TYPES as readonly string[]).includes(t) ? (t as DocumentType) : null,
    links: query.links === "none" ? "none" : null,
  };
}

export function applyDocumentFilters(rows: readonly DocumentRow[], f: DocumentFilters): DocumentRow[] {
  return rows.filter(
    (d) =>
      (!f.type || d.docType === f.type) &&
      (f.links !== "none" || d.assetIds.length + d.contractIds.length === 0),
  );
}

/** "3 assets, 1 contract" or "Not linked". */
export function linksText(d: Pick<DocumentRow, "assetIds" | "contractIds">): string {
  const parts = [
    d.assetIds.length ? `${d.assetIds.length} ${d.assetIds.length === 1 ? "asset" : "assets"}` : "",
    d.contractIds.length ? `${d.contractIds.length} ${d.contractIds.length === 1 ? "contract" : "contracts"}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Not linked";
}
